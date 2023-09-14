import { createHmac } from 'node:crypto'
import { Entity, entities } from '../Entities'
import adminAccessToken from '../config/synapse_access_token.json'
import { IdMapping } from '../entity/IdMapping'
import log from '../helpers/logger'
import { createMembership, getUserId, save } from '../helpers/storage'
import { axios } from '../helpers/synapse'

export type RcUser = {
  _id: string
  username: string
  name: string
  roles: string[]
  __rooms: string[]
}

export type MatrixUser = {
  user_id: string
  username: string
  displayname: string
  password: string
  admin: boolean
  nonce?: string
  mac?: string
  access_token?: string
}

export type AccessToken = {
  access_token: string
  device_id: string
  home_server: string
  user_id: string
}

export function mapUser(rcUser: RcUser): MatrixUser {
  return {
    user_id: '',
    username: rcUser.username,
    displayname: rcUser.name,
    password: '',
    admin: rcUser.roles.includes('admin'),
  }
}

const registrationSharedSecret = process.env.REGISTRATION_SHARED_SECRET || ''
if (!registrationSharedSecret) {
  const message = 'No REGISTRATION_SHARED_SECRET found in .env.'
  log.error(message)
  throw new Error(message)
}

const adminUsername = process.env.ADMIN_USERNAME || ''
if (!adminUsername) {
  const message = 'No ADMIN_USERNAME found in .env.'
  log.error(message)
  throw new Error(message)
}

export function generateHmac(user: MatrixUser): string {
  const hmac = createHmac('sha1', registrationSharedSecret)
  hmac.write(
    `${user.nonce}\0${user.username}\0${user.password}\0${
      user.admin ? 'admin' : 'notadmin'
    }`
  )
  hmac.end()
  return hmac.read().toString('hex')
}

async function getUserRegistrationNonce(): Promise<string> {
  return (await axios.get('/_synapse/admin/v1/register')).data.nonce
}

async function registerUser(user: MatrixUser): Promise<AccessToken> {
  return (await axios.post('/_synapse/admin/v1/register', user)).data
}

async function parseUserMemberships(rcUser: RcUser): Promise<void> {
  await Promise.all(
    rcUser.__rooms.map(async (rcRoomId: string) => {
      await createMembership(rcRoomId, rcUser._id)
      log.debug(`${rcUser.username} membership for ${rcRoomId} created`)
    })
  )
}

export function userIsExcluded(rcUser: RcUser): boolean {
  const reasons: string[] = []
  const excludedUsers = (process.env.EXCLUDED_USERS || '').split(',')
  if (rcUser.roles.includes('app')) reasons.push('has role "app"')
  if (rcUser.roles.includes('bot')) reasons.push('has role "bot"')
  if (excludedUsers.includes(rcUser._id))
    reasons.push(`id "${rcUser._id}" is on exclusion list`)
  if (excludedUsers.includes(rcUser.username))
    reasons.push(`username "${rcUser.username}" is on exclusion list`)

  if (reasons.length > 0) {
    log.warn(`User ${rcUser.name} is excluded: ${reasons.join(', ')}`)
    return true
  }
  return false
}

export async function createMapping(
  rcId: string,
  matrixUser: MatrixUser
): Promise<void> {
  const mapping = new IdMapping()
  mapping.rcId = rcId
  mapping.matrixId = matrixUser.user_id
  mapping.type = entities[Entity.Users].mappingType
  mapping.accessToken = matrixUser.access_token

  await save(mapping)
  log.debug('Mapping added:', mapping)
}

export async function createUser(rcUser: RcUser): Promise<MatrixUser> {
  const user = mapUser(rcUser)
  const nonce = await getUserRegistrationNonce()
  const mac = generateHmac({ ...user, nonce })
  const accessToken = await registerUser({ ...user, nonce, mac })
  user.user_id = accessToken.user_id
  user.access_token = accessToken.access_token
  log.info(`User ${rcUser.username} created:`, user)

  await parseUserMemberships(rcUser)

  return user
}

export async function handle(rcUser: RcUser): Promise<void> {
  log.info(`Parsing user: ${rcUser.name}: ${rcUser._id}`)

  const matrixId = await getUserId(rcUser._id)
  if (matrixId) {
    log.debug(`Mapping exists: ${rcUser._id} -> ${matrixId}`)
  } else {
    if (rcUser.username === adminUsername) {
      log.info(
        `User ${rcUser.username} is defined as admin in ENV, mapping as such`
      )
      await createMapping(rcUser._id, adminAccessToken as unknown as MatrixUser)
    } else if (!userIsExcluded(rcUser)) {
      const matrixUser = await createUser(rcUser)
      await createMapping(rcUser._id, matrixUser)
    }
  }
}
