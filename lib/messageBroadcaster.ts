import { EventEmitter } from 'events';

class MessageBroadcaster extends EventEmitter {
  private static instance: MessageBroadcaster;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent SSE connections
  }

  static getInstance(): MessageBroadcaster {
    if (!MessageBroadcaster.instance) {
      MessageBroadcaster.instance = new MessageBroadcaster();
    }
    return MessageBroadcaster.instance;
  }

  broadcast(message: any) {
    this.emit('newMessage', message);
  }
}

export const messageBroadcaster = MessageBroadcaster.getInstance();
