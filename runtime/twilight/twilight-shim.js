(function () {
  const globalObj =
    typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : globalThis;
  const subscribers = {};

  function on(event, handler) {
    if (!event || typeof handler !== 'function') return;
    subscribers[event] = subscribers[event] || [];
    subscribers[event].push(handler);
  }

  function off(event, handler) {
    if (!event || !subscribers[event]) return;
    if (!handler) {
      subscribers[event] = [];
      return;
    }
    subscribers[event] = subscribers[event].filter((fn) => fn !== handler);
  }

  function emit(event, payload) {
    (subscribers[event] || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (error) {
        console.warn('[TwilightShim] handler error', error);
      }
    });
  }

  const twilight = {
    init(options = {}) {
      global.__SALLA_TWILIGHT__ = options;
      emit('twilight:init', options);
      console.info('%cTwilight Shim Ready', 'color:#10b981;font-weight:bold;', options);
      return Promise.resolve(options);
    },
    on,
    off,
    emit,
  };

  globalObj.Salla = globalObj.Salla || {};
  globalObj.Salla.twilight = twilight;
  globalObj.Salla.event = globalObj.Salla.event || {
    on: (event, handler) => on(event, handler),
    off: (event, handler) => off(event, handler),
    emit: (event, payload) => emit(event, payload),
  };
})();
