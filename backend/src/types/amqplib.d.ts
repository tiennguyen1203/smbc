declare module "amqplib" {
  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
    on(event: string, callback: Function): void;
  }

  export interface Channel {
    assertQueue(name: string, options?: any): Promise<any>;
    sendToQueue(queue: string, content: Buffer, options?: any): boolean;
    consume(
      queue: string,
      callback: (msg: Message | null) => void
    ): Promise<any>;
    ack(message: Message): void;
    close(): Promise<void>;
  }

  export interface Message {
    content: Buffer;
    properties: {
      headers?: {
        retryCount?: number;
      };
    };
  }

  export function connect(url: string): Promise<Connection>;
}
