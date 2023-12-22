import { AxiosError } from 'axios'
import log from '../helpers/logger'
import { Entity, entities } from '../Entities'
import {
  getAllMappingsByType,
  getMappingByMatrixId,
  getMemberships,
  initStorage,
  getRoomsForMembers,
  getMapping,
} from '../helpers/storage'
import {
  axios,
  formatUserSessionOptions,
  getMatrixMembers,
  whoami,
  SessionOptions,
  getUserSessionOptions,
} from '../helpers/synapse'
import {
  getCreatorSessionOptions,
} from '../handlers/rooms'

type NestedDictionary = {
  [key: string]: {
    [innnerKey: string]: string[];
  };
};

function toString (inputString: string | undefined ): string {
  const output_str: string = inputString ?? ""
  return output_str;
}

/**
 * Send a request to Synapse, moving direct room to people
 * @param url to call
 * @param dict of direct room to transfert
 * @param creatorSessionOptions The credentials of the room creator
 */
export async function SetPeople(
  URL: string,
  DictDirect: { [innnerKey: string]: string[]; },
  creatorSessionOptions: SessionOptions | object
) {
  const data = JSON.stringify(DictDirect).replace(/'/g,'"')
  await axios.put(
    URL,
    data,
    creatorSessionOptions
  )
}

async function getMatrixIdString (inputString: string ): Promise<string> {
  const string_undefined= (await getMapping(inputString))?.matrixId
  const output_str = toString(string_undefined)
  return output_str;
}

function setDict (inputDict: NestedDictionary, room: string, inputString1: string, inputString2: string = '' ) {
  if (inputString2 == '') {
    inputString2 = inputString1
  }
  if (inputDict.hasOwnProperty(inputString1)) {
    inputDict[inputString1][inputString2] = [room]
  } else {
    inputDict[inputString1] = {}
    inputDict[inputString1][inputString2] = [room]
  }
}

export async function handle(): Promise<void> {
  const userDirectMessages: NestedDictionary = {}
  const id_m = await getAllMappingsByType(entities[Entity.DirectMessages].mappingType)
  await Promise.all(id_m.map(async (id_m) => {
    const membe = await getMemberships(id_m.rcId)
    const room_matrix = await getMatrixIdString(id_m.rcId)
    if (membe.length == 2) {
      const matrix_name_1 = await getMatrixIdString(membe[0])
      const matrix_name_2 = await getMatrixIdString(membe[1])
      setDict(userDirectMessages,room_matrix,matrix_name_1,matrix_name_2)
      setDict(userDirectMessages,room_matrix,matrix_name_2,matrix_name_1)
    } else {
      const matrix_name_1 = await getMatrixIdString(membe[0])
      setDict(userDirectMessages,room_matrix,matrix_name_1)
    }
  }));
  const keys = Object.keys(userDirectMessages)
  log.info(userDirectMessages)
  await Promise.all(keys.map(async (keys) => {
    const rc_id_t = (await getMappingByMatrixId(keys))?.rcId
    const rc_id = toString(rc_id_t)
    const creatorSessionOptions = await getCreatorSessionOptions(rc_id)
    const url = "/_matrix/client/r0/user/"+keys+"/account_data/m.direct"
    await SetPeople(url, userDirectMessages[keys], creatorSessionOptions)
  }));
}
