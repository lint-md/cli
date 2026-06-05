declare module 'eventemitter-asyncresource' {
  import { EventEmitter } from 'events';
  class EventEmitterAsyncResource extends EventEmitter {
    constructor(options?: any);
    asyncId(): number;
    triggerAsyncId(): number;
    emitDestroy(): void;
  }
  export = EventEmitterAsyncResource;
}
