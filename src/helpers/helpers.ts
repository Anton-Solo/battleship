import { CommandType, CustomWebSocket } from '../types/index';

export function parseCommand(data: any): CommandType | null {
  if (
    data &&
    typeof data.type === 'string' &&
    Object.values(CommandType).includes(data.type as CommandType)
  ) {
    return data.type as CommandType;
  }
  return null;
}
export function parseData(data: string): any {
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error) {
    return data;
  }
}

export const sendResponse = (ws: CustomWebSocket, messageData: unknown) => {
  let payloadToSend = messageData;
  if (typeof messageData === 'object' && messageData !== null && 'data' in messageData) {
    payloadToSend = {
      ...(messageData as object),
      data: JSON.stringify(messageData.data),
    };
  }
  ws.send(JSON.stringify(payloadToSend));
  console.log(`\nSend message to ${ws.connectionId}:`);
  console.log(JSON.stringify(payloadToSend, null, 2));
};
