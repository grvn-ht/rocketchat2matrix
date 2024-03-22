import lineByLine from 'n-readlines'
import { entities } from '../Entities'
import log from '../helpers/logger'
import {
  getRoomId,
  getMessageId,
  getAccessToken,
  getMemberships,
  getUserId,
} from '../helpers/storage'
import { axios, formatUserSessionOptions } from '../helpers/synapse'
import { RcMessage } from './messages'

/**
 * Reads the input file for messages, when we found last room message, we make all user of the room read it
 * @returns last message for each room
 */
export async function getLastRoomMessages(): Promise<
  Record<string, Record<string, string>>
> {
  let lastMessages: Record<string, Record<string, string>> = {}
  const filePath = process.argv[2]; // The first argument after the script name
  const rl = new lineByLine(`./${filePath}`)
  //const rl = new lineByLine(`./inputs/${entities.messages.filename}`)
  let line: false | Buffer
  while ((line = rl.next())) {
    const message: RcMessage = JSON.parse(line.toString())
    if (!message.t) {
      if (!lastMessages[message.rid]) {
        lastMessages[message.rid] = {};
      }
      if (!message.tmid) {
        lastMessages[message.rid]["main"] = message._id
      } else {
        lastMessages[message.rid][message.tmid] = message._id
      }
    }
  }
  return lastMessages
}

/**
 * Sets the m.room.pinned_events settings for rooms.
 * @param pinnedMessages An object containing rooms and their pinned message, to be set in synapse
 */
export async function markAllAsRead(
  lastMessages: Record<string, Record<string, string>>
): Promise<void> {
  //const messages: RcMessage[] = Object.values(lastMessages)

  let matrixtmid: string | undefined = ""
  for (const rid in lastMessages) {
    const userRcIdList = await getMemberships(rid)
    const matrixRoomId = await getRoomId(rid)
    for (const tmid in lastMessages[rid]) {
      const messageid = lastMessages[rid][tmid];
      const matrixMessageId = await getMessageId(messageid)
      if (tmid === "main") {
        matrixtmid = "main"
      } else {
        matrixtmid = await getMessageId(tmid)
      }
      for (const userRcId of userRcIdList) {
        const token = await getAccessToken(userRcId)
        if (typeof token === 'string' && matrixMessageId) {
          const userSessionOptions = await formatUserSessionOptions(token)
          const matrix_user = await getUserId(userRcId)
          log.http(
            `Mark all messages as read in room ${matrixRoomId} for user ${matrix_user} in thread ${matrixtmid}`,
            (
              await axios.post(
                `/_matrix/client/v3/rooms/${matrixRoomId}/receipt/m.read/${matrixMessageId}`,
                { thread_id: matrixtmid },
                userSessionOptions
              )
            ).data
          )
        }
      }
    }
  }


  //for (const message of messages) {
  //  const userRcIdList = await getMemberships(message.rid)
  //  const matrixRoomId = await getRoomId(message.rid)
  //  const matrixMessageId = await getMessageId(message._id)
  //  for (const userRcId of userRcIdList) {
  //    const token = await getAccessToken(userRcId)
  //    if (typeof token === 'string' && matrixMessageId) {
  //      const userSessionOptions = await formatUserSessionOptions(token)
  //      const matrix_user = await getUserId(userRcId)
  //      log.http(
  //        `Mark all messages as read in room ${matrixRoomId} for user ${matrix_user}`,
  //        (
  //          await axios.post(
  //            `/_matrix/client/v3/rooms/${matrixRoomId}/receipt/m.read/${matrixMessageId}`,
  //            { thread_id: 'main' },
  //            userSessionOptions
  //          )
  //        ).data
  //      )
  //    }
  //  }
  //}
}

/**
 * Handle pinned messages for all rooms, marking pinned messages as such in the room settings
 */
export async function handleMarkAllAsRead() {
  const lastMessages = await getLastRoomMessages()
  await markAllAsRead(lastMessages)
}
