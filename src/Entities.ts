export const enum Entity {
  Users = 'users',
  Rooms = 'rooms',
  Messages = 'messages',
  DirectMessages = 'directmessages'
}

type EntityConfig = {
  filename: string
  mappingType: number
}

export const entities: {
  [key in Entity]: EntityConfig
} = {
  users: {
    filename: 'users.json',
    mappingType: 0,
  },
  rooms: {
    filename: 'rocketchat_room.json',
    mappingType: 1,
  },
  messages: {
    filename: 'rocketchat_message.json',
    mappingType: 2,
  },
  directmessages: {
    filename: 'rocketchat_room.json',
    mappingType: 3,
  },
} as const
