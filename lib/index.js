// ../../.bun/install/global/node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === undefined;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys)
    return { ...source };
  const result = {};
  for (const key of keys)
    if (forced || source[key] !== undefined)
      result[key] = source[key];
  return result;
}
function defineProperty(object, key, value) {
  return Object.defineProperty(object, key, {
    writable: true,
    value,
    enumerable: false
  });
}
var write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set) {
  if (typeof value === "function")
    throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object")
    return value;
  if (ancestors.has(value))
    throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value))
      return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value) => {
      current = value;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1)
    return (value) => is(type, value);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary) {
  Binary.is = isArrayBufferLike;
  Binary.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source))
      return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else
      return source;
  }
  Binary.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined")
      return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0;i < bytes.byteLength; i++)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined")
      return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined")
      return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined")
      return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0;i < hex.length; i += 2)
      buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map) {
  if (!source || typeof source !== "object")
    return source;
  if (is("Date", source))
    return new Date(source.valueOf());
  if (is("RegExp", source))
    return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source))
    return source.slice(0);
  if (ArrayBuffer.isView(source))
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached)
    return cached;
  if (Array.isArray(source)) {
    const result = [];
    refs.set(source, result);
    source.forEach((value, index) => {
      result[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor)
      descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set;
  function compare(a, b) {
    if (a === b)
      return true;
    if (isVolatile(a) || isVolatile(b))
      return isVolatile(a) && isVolatile(b);
    if (!strict && isNullable(a) && isNullable(b))
      return true;
    if (typeof a !== typeof b || typeof a !== "object" || !a || !b)
      return false;
    if (ancestors.has(a))
      return false;
    function check(test, then) {
      return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : undefined;
    }
    ancestors.add(a);
    try {
      return check(Array.isArray, (a, b) => {
        if (a.length !== b.length)
          return false;
        for (let index = 0;index < a.length; index++)
          if (!compare(a[index], b[index]))
            return false;
        return true;
      }) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("URL"), (a, b) => a.href === b.href) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
        if (a.byteLength !== b.byteLength)
          return false;
        const viewA = new Uint8Array(a);
        const viewB = new Uint8Array(b);
        for (let i = 0;i < viewA.length; i++)
          if (viewA[i] !== viewB[i])
            return false;
        return true;
      }) ?? ((!strict || [a, b].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a,
        ...b
      }).every((key) => compare(a[key], b[key])));
    } finally {
      ancestors.delete(a);
    }
  }
  return compare(a, b);
}
function tokenize(source, delimiters, delimiter) {
  const output = [];
  let state = 0;
  for (let i = 0;i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      if (state === 1) {
        const next = source.charCodeAt(i + 1);
        if (next >= 97 && next <= 122)
          output.push(delimiter);
        output.push(code + 32);
      } else {
        if (state !== 0)
          output.push(delimiter);
        output.push(code + 32);
      }
      state = 1;
    } else if (code >= 97 && code <= 122) {
      output.push(code);
      state = 2;
    } else if (delimiters.includes(code)) {
      if (state !== 0)
        output.push(delimiter);
      state = 0;
    } else
      output.push(code);
  }
  return String.fromCharCode(...output);
}
function paramCase(source) {
  return tokenize(source, [45, 95], 45);
}
var hyphenate = paramCase;
var Time;
(function(Time) {
  Time.millisecond = 1;
  Time.second = 1000;
  Time.minute = Time.second * 60;
  Time.hour = Time.minute * 60;
  Time.day = Time.hour * 24;
  Time.week = Time.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date = /* @__PURE__ */ new Date, offset) {
    if (typeof date === "number")
      date = new Date(date);
    if (offset === undefined)
      offset = timezoneOffset;
    return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
  }
  Time.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date = new Date(value * Time.day);
    if (offset === undefined)
      offset = timezoneOffset;
    return new Date(+date + offset * Time.minute);
  }
  Time.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture)
      return 0;
    return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
  }
  Time.parseTime = parseTime;
  function parseDate(date) {
    const parsed = parseTime(date);
    if (parsed)
      date = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date))
      date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date))
      date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
    return date ? new Date(date) : /* @__PURE__ */ new Date;
  }
  Time.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time.day - Time.hour / 2)
      return Math.round(ms / Time.day) + "d";
    else if (abs >= Time.hour - Time.minute / 2)
      return Math.round(ms / Time.hour) + "h";
    else if (abs >= Time.minute - Time.second / 2)
      return Math.round(ms / Time.minute) + "m";
    else if (abs >= Time.second)
      return Math.round(ms / Time.second) + "s";
    return ms + "ms";
  }
  Time.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time.toDigits = toDigits;
  function template(template, time = /* @__PURE__ */ new Date) {
    return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time.template = template;
})(Time || (Time = {}));

// ../../.bun/install/global/node_modules/@deepseek-ai/cordis/lib/index.js
var DisposableList = class {
  sn = 0;
  map = /* @__PURE__ */ new Map;
  weak = /* @__PURE__ */ new WeakMap;
  get length() {
    return this.map.size;
  }
  push(value) {
    const sn = ++this.sn;
    this.map.set(sn, value);
    this.weak.set(value, sn);
    return () => this.map.delete(sn);
  }
  delete(value) {
    const sn = this.weak.get(value);
    if (!sn)
      return false;
    return this.map.delete(sn);
  }
  clear() {
    const values = [...this.map.values()];
    this.map.clear();
    return values.reverse();
  }
  [Symbol.iterator]() {
    return this.map.values();
  }
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this];
  }
};
var symbols = {
  shadow: Symbol.for("cordis.shadow"),
  caller: Symbol.for("cordis.caller"),
  receiver: Symbol.for("cordis.receiver"),
  original: Symbol.for("cordis.original"),
  metadata: Symbol.for("cordis.metadata"),
  initHooks: Symbol.for("cordis.initHooks"),
  checkProto: Symbol.for("cordis.checkProto"),
  effect: Symbol.for("cordis.effect"),
  filter: Symbol.for("cordis.filter"),
  isolate: Symbol.for("cordis.isolate"),
  intercept: Symbol.for("cordis.intercept"),
  init: Symbol.for("cordis.init"),
  check: Symbol.for("cordis.check"),
  config: Symbol.for("cordis.config"),
  invoke: Symbol.for("cordis.invoke"),
  extend: Symbol.for("cordis.extend"),
  tracker: Symbol.for("cordis.tracker"),
  resolveConfig: Symbol.for("cordis.resolveConfig")
};
var GeneratorFunction = function* () {}.constructor;
var AsyncGeneratorFunction = async function* () {}.constructor;
function isConstructor(func) {
  if (!func.prototype)
    return false;
  if (func instanceof GeneratorFunction)
    return false;
  if (AsyncGeneratorFunction !== Function && func instanceof AsyncGeneratorFunction)
    return false;
  return true;
}
function joinPrototype(proto1, proto2) {
  if (proto1 === Object.prototype)
    return proto2;
  const result = Object.create(joinPrototype(Object.getPrototypeOf(proto1), proto2));
  for (const key of Reflect.ownKeys(proto1))
    Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(proto1, key));
  return result;
}
function isObject(value) {
  return value && (typeof value === "object" || typeof value === "function");
}
function getPropertyDescriptor(target, prop) {
  let proto = target;
  while (proto) {
    const desc = Reflect.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = Object.getPrototypeOf(proto);
  }
}
function getTraceable(ctx, value) {
  if (!isObject(value))
    return value;
  if (Object.hasOwn(value, symbols.shadow))
    return Object.getPrototypeOf(value);
  const tracker = value[symbols.tracker];
  if (!tracker)
    return value;
  return createTraceable(ctx, value, tracker);
}
function withProps(target, props) {
  if (!props)
    return target;
  return new Proxy(target, {
    get: (target, prop, receiver) => {
      if (prop in props && prop !== "constructor")
        return Reflect.get(props, prop, receiver);
      return Reflect.get(target, prop, receiver);
    },
    set: (target, prop, value, receiver) => {
      if (prop in props && prop !== "constructor")
        return Reflect.set(props, prop, value, receiver);
      return Reflect.set(target, prop, value, receiver);
    }
  });
}
function withProp(target, prop, value) {
  return withProps(target, Object.defineProperty(Object.create(null), prop, {
    value,
    writable: false
  }));
}
function createShadow(useSite, target, property, receiver) {
  if (!property)
    return receiver;
  const value = getPropertyDescriptor(target, property)?.value;
  if (!value)
    return receiver;
  const defSite = value[symbols.shadow] ?? value;
  return withProp(receiver, property, useSite.extend({ [symbols.shadow]: defSite }));
}
function createShadowMethod(ctx, value, outer, shadow) {
  return new Proxy(value, { apply: (target, thisArg, args) => {
    if (thisArg === outer)
      thisArg = shadow;
    return getTraceable(ctx, Reflect.apply(target, thisArg, args));
  } });
}
function createTraceable(ctx, value, tracker) {
  const defSite = ctx[symbols.shadow] ?? ctx;
  const useSite = ctx[symbols.shadow] ? Object.getPrototypeOf(ctx) : ctx;
  const proxy = new Proxy(value, {
    get: (target, prop, receiver) => {
      if (prop === symbols.original)
        return target;
      if (prop === symbols.caller)
        return defSite;
      if (prop === tracker.property)
        return useSite;
      if (typeof prop === "symbol")
        return Reflect.get(target, prop, receiver);
      if (tracker.associate && useSite.reflect.props[`${tracker.associate}.${prop}`])
        return Reflect.get(ctx, `${tracker.associate}.${prop}`, withProp(ctx, symbols.receiver, receiver));
      let shadow, innerValue;
      const desc = getPropertyDescriptor(target, prop);
      if (desc && "value" in desc)
        innerValue = desc.value;
      else {
        shadow = createShadow(useSite, target, tracker.property, receiver);
        innerValue = Reflect.get(target, prop, shadow);
      }
      const innerTracker = innerValue?.[symbols.tracker];
      if (innerTracker)
        return createTraceable(useSite, innerValue, innerTracker);
      else if (!tracker.noShadow && typeof innerValue === "function") {
        shadow ??= createShadow(useSite, target, tracker.property, receiver);
        return createShadowMethod(useSite, innerValue, receiver, shadow);
      } else
        return innerValue;
    },
    set: (target, prop, value, receiver) => {
      if (prop === symbols.original)
        return false;
      if (prop === symbols.caller)
        return false;
      if (prop === tracker.property)
        return false;
      if (typeof prop === "symbol")
        return Reflect.set(target, prop, value, receiver);
      if (tracker.associate && useSite.reflect.props[`${tracker.associate}.${prop}`])
        return Reflect.set(ctx, `${tracker.associate}.${prop}`, value, withProp(ctx, symbols.receiver, receiver));
      const shadow = createShadow(useSite, target, tracker.property, receiver);
      return Reflect.set(target, prop, value, shadow);
    },
    apply: (target, thisArg, args) => {
      return applyTraceable(tracker.noShadow ? proxy : createShadow(useSite, target, tracker.property, proxy), target, thisArg, args);
    }
  });
  return proxy;
}
function applyTraceable(proxy, value, thisArg, args) {
  if (!value[symbols.invoke])
    return Reflect.apply(value, thisArg, args);
  return value[symbols.invoke].apply(proxy, args);
}
function createCallable(name, proto, tracker) {
  const self = function(...args) {
    const proxy = createTraceable(self["ctx"], self, tracker);
    return Reflect.apply(proxy, this, args);
  };
  defineProperty(self, "name", name);
  return Object.setPrototypeOf(self, proto);
}
function handleError(info, reason, getOuterStack) {
  const innerLines = info.error.stack.split(`
`);
  if (typeof reason?.stack !== "string") {
    const outerError = new Error(reason);
    const lines = outerError.stack.split(`
`);
    lines.splice(1, Infinity, ...getOuterStack());
    outerError.stack = lines.join(`
`);
    throw outerError;
  }
  const lines = reason.stack.split(`
`);
  let index = lines.indexOf(innerLines[2]);
  if (index === -1)
    throw reason;
  index -= info.offset;
  while (index > 0) {
    if (!lines[index - 1].endsWith(" (<anonymous>)"))
      break;
    index -= 1;
  }
  lines.splice(index, Infinity, ...getOuterStack());
  reason.stack = lines.join(`
`);
  throw reason;
}
function composeError(callback, getOuterStack = buildOuterStack()) {
  const info = {
    offset: 1,
    error: /* @__PURE__ */ new Error
  };
  try {
    const result = callback(info);
    if (isObject(result) && "then" in result)
      return result.then(undefined, (reason) => handleError(info, reason, getOuterStack));
    else
      return result;
  } catch (reason) {
    handleError(info, reason, getOuterStack);
  }
}
function buildOuterStack(offset = 0) {
  const outerError = /* @__PURE__ */ new Error;
  return () => outerError.stack.split(`
`).slice(3 + offset);
}
var kValidationError = Symbol.for("ValidationError");
var ValidationError = class extends TypeError {
  name = "ValidationError";
  constructor(issues) {
    super(`invalid config:
` + issues.map((issue) => {
      if (issue.path)
        return `  - ${issue.message} (at ${issue.path.join(".")})`;
      else
        return `  - ${issue.message}`;
    }).join(`
`));
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
function resolveConfig(runtime, config) {
  if (!runtime.Config)
    return config;
  const result = runtime.Config["~standard"].validate(config);
  if ("then" in result)
    throw new TypeError("Async config validation is not supported");
  if (result.issues)
    throw new ValidationError(result.issues);
  else
    return result.value;
}
var effectInertia = /* @__PURE__ */ new WeakMap;
function runDisposable(dispose) {
  const result = dispose();
  return effectInertia.get(dispose)?.() ?? result;
}
function emitPluginDisposed(context, fiber) {
  const args = ["internal/plugin", fiber];
  let callbacks;
  try {
    callbacks = context.events.dispatch("emit", args);
  } catch (error) {
    context.logger.error(error);
    return;
  }
  for (const callback of callbacks)
    try {
      const returned = callback(...args);
      Promise.resolve(returned).catch((error) => context.logger.error(error));
    } catch (error) {
      context.logger.error(error);
    }
}
var CordisError = class CordisError extends Error {
  code;
  constructor(code, message) {
    super(message ?? CordisError.Code[code]);
    this.code = code;
  }
};
(function(CordisError) {
  CordisError.Code = { INACTIVE_EFFECT: "cannot create effect on inactive context" };
})(CordisError || (CordisError = {}));
var INACTIVE = "__INACTIVE__";
var Fiber = class {
  parent;
  inject;
  runtime;
  uid;
  ctx;
  config;
  state = 0;
  dispose;
  committed;
  provisions = /* @__PURE__ */ new Set;
  inertia;
  _hooks = Object.create(null);
  _disposables = new DisposableList;
  context;
  _error;
  _revision = 0;
  _configRevision = 0;
  _effectiveConfig;
  _runner;
  _store = Object.create(null);
  _release;
  constructor(parent, config, inject, runtime, getOuterStack) {
    this.parent = parent;
    this.inject = inject;
    this.runtime = runtime;
    this.config = config;
    const collect = (dispose) => {
      this._disposables.push(dispose);
    };
    if (runtime) {
      this.uid = parent.registry.counter;
      this.ctx = this.context = parent.extend({ fiber: this });
      const injectEntries = Object.entries(this.inject);
      if (injectEntries.length) {
        this.ctx[Context.intercept] = Object.create(parent[Context.intercept]);
        for (const [name, config] of injectEntries) {
          if (isNullable(config))
            continue;
          this.ctx[Context.intercept][name] = config;
        }
      }
      this._runner = {
        epoch: INACTIVE,
        getOuterStack,
        execute: function() {
          const config = this.resolveConfig(this.config);
          this._effectiveConfig = config;
          if (isConstructor(runtime.callback)) {
            const instance = new runtime.callback(this.ctx, config);
            for (const hook of instance?.[symbols.initHooks] ?? [])
              hook();
            return instance?.[symbols.init]?.();
          } else
            return runtime.callback(this.ctx, config);
        },
        collect
      };
      this.dispose = parent.fiber.effect(() => {
        const remove = runtime.fibers.push(this);
        return async () => {
          this.uid = null;
          emitPluginDisposed(this.context, this);
          if (this.ctx.registry.has(runtime.callback)) {
            remove();
            if (!runtime.fibers.length)
              this.ctx.registry.delete(runtime.callback);
          }
          this._setEpoch(INACTIVE);
          if (!this.inertia)
            this._updateState(() => {
              this.inertia = this._unload();
              return 5;
            });
          while (this.inertia)
            await this.inertia;
        };
      }, "ctx.plugin()");
      try {
        this.context.emit("internal/plugin", this);
      } catch (error) {
        Promise.resolve(this.dispose()).catch((reason) => this.ctx.logger.error(reason));
        throw error;
      }
      if (this.uid !== null && parent.fiber.state !== 5) {
        for (const name of Object.keys(this.inject))
          this._checkImpl(name);
        this._refresh();
      }
    } else {
      this.uid = 0;
      this.ctx = this.context = parent;
      this.state = 2;
      this.committed = Object.create(null);
      this._runner = {
        epoch: "0",
        getOuterStack,
        execute: () => {},
        collect
      };
      this.dispose = () => this.restart();
    }
  }
  get name() {
    let fiber = this;
    do {
      if (fiber.runtime?.name)
        return fiber.runtime.name;
      fiber = fiber.parent.fiber;
    } while (fiber !== fiber.parent.fiber);
    return "root";
  }
  assertActive() {
    if (this.uid !== null)
      return;
    throw new CordisError("INACTIVE_EFFECT");
  }
  _execute(runner) {
    const oldEpoch = runner.epoch;
    return composeError((info) => {
      const safeCollect = (dispose) => {
        if (typeof dispose === "function")
          runner.collect(dispose);
        else if (!isNullable(dispose))
          throw new TypeError("Invalid effect");
      };
      const effect = runner.execute.call(this);
      if (typeof effect === "function")
        return runner.collect(effect);
      else if (isNullable(effect)) {} else if (!isObject(effect))
        throw new TypeError("Invalid effect");
      else if ("then" in effect)
        return effect.then(safeCollect);
      else if (Symbol.iterator in effect) {
        info.error = /* @__PURE__ */ new Error;
        const iter = effect[Symbol.iterator]();
        while (true) {
          const result = iter.next();
          safeCollect(result.value);
          if (result.done)
            return;
        }
      } else if (Symbol.asyncIterator in effect) {
        const iter = effect[Symbol.asyncIterator]();
        return (async () => {
          await Promise.resolve();
          info.error = /* @__PURE__ */ new Error;
          while (true) {
            if (runner.epoch !== oldEpoch)
              return;
            const result = await iter.next();
            safeCollect(result.value);
            if (result.done)
              return;
          }
        })();
      } else
        throw new TypeError("Invalid effect");
    }, runner.getOuterStack);
  }
  effect(execute, label = "anonymous") {
    this.assertActive();
    if (this.state === 5)
      throw new CordisError("INACTIVE_EFFECT");
    const disposables = [];
    let disposing = false;
    let disposalTask;
    const dispose = () => {
      if (disposing)
        return disposalTask;
      disposing = true;
      let task;
      for (const disposable of disposables.splice(0).reverse())
        if (task)
          task = task.then(() => runDisposable(disposable));
        else {
          const result = runDisposable(disposable);
          if (isObject(result) && "then" in result)
            task = result;
        }
      return disposalTask = task;
    };
    const meta = {
      label,
      children: []
    };
    const runner = {
      execute,
      epoch: true,
      collect: (dispose) => {
        disposables.push(dispose);
        this._disposables.delete(dispose);
        if (dispose[symbols.effect])
          meta.children.push(dispose[symbols.effect]);
      },
      getOuterStack: buildOuterStack()
    };
    let task;
    let executing = true;
    let resolveSetup;
    let rejectSetup;
    let setupBarrier;
    let setupFailed = false;
    let inFlight;
    let removeWrapper = () => false;
    const waitForSetup = () => {
      setupBarrier ??= new Promise((resolve, reject) => {
        resolveSetup = resolve;
        rejectSetup = reject;
      });
      return setupBarrier;
    };
    const disposeAfter = (setup) => {
      return Promise.resolve(setup).then(() => dispose(), async (reason) => {
        await dispose();
        throw reason;
      });
    };
    const finalizeDisposal = (callback) => {
      let result;
      try {
        result = callback();
      } catch (error) {
        removeWrapper();
        throw error;
      }
      if (isObject(result) && "then" in result) {
        const pending = Promise.resolve(result).finally(() => {
          removeWrapper();
          if (inFlight === pending)
            inFlight = undefined;
        });
        return inFlight = pending;
      }
      removeWrapper();
      return result;
    };
    const wrapper = defineProperty(() => {
      if (!runner.epoch)
        return setupFailed ? inFlight : undefined;
      runner.epoch = false;
      return finalizeDisposal(() => {
        if (executing)
          return disposeAfter(waitForSetup());
        return task ? disposeAfter(task) : dispose();
      });
    }, symbols.effect, meta);
    effectInertia.set(wrapper, () => inFlight);
    removeWrapper = this._disposables.push(wrapper);
    try {
      task = this._execute(runner);
    } catch (reason) {
      executing = false;
      setupFailed = true;
      runner.epoch = false;
      let cleanup;
      try {
        cleanup = finalizeDisposal(dispose);
      } finally {
        rejectSetup?.(reason);
      }
      if (isObject(cleanup) && "then" in cleanup)
        cleanup.catch((error) => this.ctx.logger.error(error));
      throw reason;
    }
    executing = false;
    if (setupBarrier)
      Promise.resolve(task).then(resolveSetup, rejectSetup);
    task?.catch(() => {
      if (!runner.epoch)
        return dispose();
      return finalizeDisposal(dispose);
    }).catch((error) => this.ctx.logger.error(error));
    const disposeAsync = () => {
      if (!runner.epoch)
        return;
      runner.epoch = false;
      return finalizeDisposal(dispose);
    };
    wrapper.then = async (onFulfilled, onRejected) => {
      return Promise.resolve(task).then(() => disposeAsync).then(onFulfilled, onRejected);
    };
    return wrapper;
  }
  getEffects() {
    return [...this._disposables].map((dispose) => dispose[symbols.effect]).filter(Boolean);
  }
  _getState() {
    if (this.uid === null)
      return 4;
    if (this._error)
      return 3;
    if (this._runner.epoch !== INACTIVE)
      return 2;
    return 0;
  }
  _updateState(callback) {
    const oldState = this.state;
    this.state = callback() ?? this._getState();
    if (oldState === this.state)
      return;
    this.context.emit("internal/status", this, oldState);
    if (oldState !== 2 && this.state !== 2)
      return;
    for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
      const impl = this.ctx.reflect.store[key];
      if (impl.ctx.fiber !== this)
        continue;
      this.ctx.isolate(impl.name, impl.isolate).reflect.notify([impl.name]);
    }
  }
  _checkImpl(name) {
    const impl = this.ctx.reflect._getImpl(name, true);
    if (!impl)
      return delete this._store[name];
    try {
      if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value)))
        return delete this._store[name];
    } catch (error) {
      impl.ctx.logger.error(error);
      return delete this._store[name];
    }
    this._store[name] = impl;
  }
  _refresh() {
    let epoch = `${this._revision}`;
    for (const name of Object.keys(this.inject)) {
      const impl = this._store[name];
      if (!impl) {
        epoch = INACTIVE;
        break;
      }
      epoch += ":" + impl.uid;
    }
    this._setEpoch(epoch);
  }
  _setEpoch(epoch) {
    const oldEpoch = this._runner.epoch;
    if (epoch === oldEpoch)
      return;
    if (this._error)
      return;
    this._runner.epoch = epoch;
    if (this.inertia)
      return;
    this._updateState(() => {
      if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
        this.inertia = this._reload();
        return 1;
      } else {
        this.inertia = this._unload();
        return 5;
      }
    });
  }
  get rawConfig() {
    return this.ctx.fiber.config;
  }
  set rawConfig(config) {
    this.ctx.fiber.config = config;
    this.ctx.fiber._configRevision++;
  }
  get effectiveConfig() {
    return this.ctx.fiber._effectiveConfig;
  }
  resolveConfig(config) {
    const fiber = this.ctx.fiber;
    return fiber.context.waterfall("internal/config", fiber, () => config);
  }
  async _reload() {
    this.committed = { ...this._store };
    for (const impl of Object.values(this.committed)) {
      if (impl.ctx.fiber === this)
        continue;
      impl.dependents.add(this);
    }
    const oldEpoch = this._runner.epoch;
    try {
      await Promise.resolve();
      if (this._runner.epoch === oldEpoch)
        await this._execute(this._runner);
    } catch (reason) {
      this.ctx.logger.error(reason);
      if (this._runner.epoch === oldEpoch) {
        this._error = reason;
        this._runner.epoch = INACTIVE;
      }
    }
    this._updateState(() => {
      if (this._runner.epoch === oldEpoch)
        this.inertia = undefined;
      else {
        this.inertia = this._unload();
        return 5;
      }
    });
  }
  async _unload() {
    while ([...this.provisions].some((impl) => impl.dependents.size))
      await new Promise((resolve) => this._release = resolve);
    this._release = undefined;
    await Promise.all(this._disposables.clear().map(async (dispose) => {
      try {
        await composeError(async (info) => {
          await Promise.resolve();
          info.error = /* @__PURE__ */ new Error;
          await runDisposable(dispose);
        }, this._runner.getOuterStack);
      } catch (reason) {
        this.ctx.logger.error(reason);
      }
    }));
    for (const impl of Object.values(this.committed ?? {})) {
      if (!impl.dependents.delete(this) || impl.dependents.size)
        continue;
      impl.release?.();
      impl.ctx.fiber._release?.();
    }
    this.committed = undefined;
    this._updateState(() => {
      if (this._runner.epoch === INACTIVE)
        this.inertia = undefined;
      else {
        this.inertia = this._reload();
        return 1;
      }
    });
  }
  async await() {
    while (this.inertia)
      await this.inertia;
    if (this._error)
      throw this._error;
    return this;
  }
  async restart() {
    const fiber = this.ctx.fiber;
    fiber.assertActive();
    fiber._revision++;
    fiber._refresh();
    await fiber.await();
  }
  update(config, noSave = false) {
    const fiber = this.ctx.fiber;
    fiber.assertActive();
    const loaded = fiber._runner.epoch !== INACTIVE;
    const resolved = loaded ? fiber.resolveConfig(config) : undefined;
    if (!noSave)
      fiber.context.emit("internal/commit", fiber, config);
    fiber.config = config;
    fiber._error = undefined;
    const configRevision = ++fiber._configRevision;
    const epoch = fiber._runner.epoch;
    const committed = fiber.committed;
    let restarted = false;
    const restart = () => {
      restarted = true;
      return fiber.restart();
    };
    const publish = () => {
      if (!restarted && fiber.uid !== null && fiber._configRevision === configRevision && fiber._runner.epoch === epoch && fiber.committed === committed)
        fiber._effectiveConfig = resolved;
    };
    const result = loaded ? fiber.context.waterfall(fiber, "internal/update", resolved, restart) : restart();
    if (result === undefined) {
      publish();
      return;
    }
    const task = Promise.resolve(result).then(publish);
    task.catch(() => {});
    return task;
  }
};
function isBailed(value) {
  return value !== null && value !== false && value !== undefined;
}
var EventsService = class {
  ctx;
  _hooks = Object.create(null);
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
    this.on("internal/listener", function(name, listener, options) {
      if (name === "internal/update" && !options.global) {
        const hooks = this.fiber._hooks["internal/update"] ??= new DisposableList;
        const method = options.prepend ? "unshift" : "push";
        return this.fiber.effect(() => hooks[method](listener), 'ctx.on("internal/update")');
      }
    });
    this.on("internal/update", function(config, next) {
      const cbs = [...this._hooks["internal/update"] || []];
      const _next = () => {
        return (cbs.shift() ?? next).call(this, config, _next);
      };
      return _next();
    }, {
      global: true,
      prepend: true
    });
    this.on("internal/config", (fiber, next) => {
      const config = next();
      return fiber.runtime ? resolveConfig(fiber.runtime, config) : config;
    });
  }
  _resolve(type, args) {
    const thisArg = typeof args[0] === "object" || typeof args[0] === "function" ? args.shift() : null;
    const name = args.shift();
    if ((typeof name !== "string" || !name.startsWith("internal/")) && this._hooks["internal/dispatch"]?.length)
      this.emit("internal/dispatch", type, name, args, thisArg);
    const filter = thisArg?.[Context.filter];
    return [thisArg, (this._hooks[name] || []).filter((hook) => hook.global || !filter || filter.call(thisArg, hook.ctx)).map((hook) => hook.callback)];
  }
  dispatch(type, args) {
    const [thisArg, callbacks] = this._resolve(type, args);
    return callbacks.map((callback) => callback.bind(thisArg));
  }
  async parallel(...args) {
    const [thisArg, callbacks] = this._resolve("parallel", args);
    const errors = (await Promise.allSettled(callbacks.map(async (callback) => Reflect.apply(callback, thisArg, args)))).filter((result) => result.status === "rejected");
    if (errors.length)
      throw new AggregateError(errors.map((error) => error.reason));
  }
  emit(...args) {
    const [thisArg, callbacks] = this._resolve("emit", args);
    for (const callback of callbacks)
      Reflect.apply(callback, thisArg, args);
  }
  async serial(...args) {
    const [thisArg, callbacks] = this._resolve("serial", args);
    for (const callback of callbacks) {
      const result = await Reflect.apply(callback, thisArg, args);
      if (isBailed(result))
        return result;
    }
  }
  bail(...args) {
    const [thisArg, callbacks] = this._resolve("bail", args);
    for (const callback of callbacks) {
      const result = Reflect.apply(callback, thisArg, args);
      if (isBailed(result))
        return result;
    }
  }
  waterfall(...args) {
    const [thisArg, callbacks] = this._resolve("waterfall", args);
    const inner = args.pop();
    const dispatch = () => {
      const callback = callbacks.shift();
      if (!callback)
        return inner();
      let called = false;
      const next = () => {
        if (called)
          throw new Error("next() called multiple times");
        called = true;
        return dispatch();
      };
      return Reflect.apply(callback, thisArg, [...args, next]);
    };
    return dispatch();
  }
  register(label, name, callback, options) {
    const method = options.prepend ? "unshift" : "push";
    return this.ctx.fiber.effect(() => {
      (this._hooks[name] ??= [])[method]({
        ctx: this.ctx,
        callback,
        ...options
      });
      return () => this.unregister(name, callback);
    }, label);
  }
  unregister(name, callback) {
    const hooks = this._hooks[name];
    if (!hooks)
      return;
    const index = hooks.findIndex((hook) => hook.callback === callback);
    if (index >= 0) {
      hooks.splice(index, 1);
      if (!hooks.length)
        delete this._hooks[name];
      return true;
    }
  }
  on(name, listener, options) {
    if (typeof options !== "object")
      options = { prepend: options };
    this.ctx.fiber.assertActive();
    listener = this.ctx.reflect.bind(listener);
    const result = this.bail(this.ctx, "internal/listener", name, listener, options);
    if (result)
      return result;
    const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
    return this.register(label, name, listener, options);
  }
  once(name, listener, options) {
    const dispose = this.on(name, function(...args) {
      dispose();
      return listener.apply(this, args);
    }, options);
    return dispose;
  }
};
var defaultFormatters = {
  s: (value) => String(value),
  d: (value) => Math.trunc(Number(value)),
  i: (value) => Math.trunc(Number(value)),
  f: (value) => Number(value),
  o: (value) => JSON.stringify(value),
  O: (value) => JSON.stringify(value),
  c: () => "",
  C: (value, exporter, message) => {
    return Logger.color(exporter, Logger.code(message.name, exporter.colors), value);
  }
};
function isAggregateError(error) {
  return error instanceof Error && Array.isArray(error["errors"]);
}
var Logger = class {
  service;
  static color(exporter, code, value, decoration = "") {
    if (!exporter.colors)
      return "" + value;
    return `\x1B[3${code < 8 ? code : "8;5;" + code}${exporter.colors >= 2 ? decoration : ""}m${value}\x1B[0m`;
  }
  static code(name, level) {
    let hash = 0;
    for (let i = 0;i < name.length; i++) {
      hash = (hash << 3) - hash + name.charCodeAt(i) + 13;
      hash |= 0;
    }
    const colors = !level ? [] : level >= 2 ? c256 : c16;
    return colors[Math.abs(hash) % colors.length];
  }
  static format(exporter, message) {
    const args = message.args.slice();
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message;
      args.unshift("%s");
    } else if (typeof args[0] !== "string")
      args.unshift("%o");
    let format = args.shift();
    format = format.replace(/%([a-zA-Z%])/g, (match, char) => {
      if (match === "%%")
        return "%";
      const formatter = exporter.formatters?.[char] ?? defaultFormatters[char];
      if (typeof formatter === "function")
        return formatter(args.shift(), exporter, message);
      return match;
    });
    const oFormatter = exporter.formatters?.o ?? defaultFormatters.o;
    for (let arg of args) {
      if (typeof arg === "object" && arg)
        arg = oFormatter(arg, exporter, message);
      format += " " + arg;
    }
    const { maxLength = 10240 } = exporter;
    return format.split(/\r?\n/g).map((line) => {
      return line.slice(0, maxLength) + (line.length > maxLength ? "..." : "");
    }).join(`
`);
  }
  constructor(options, service) {
    this.service = service;
    Object.assign(this, options);
    this.error = this._method("error", 0);
    this.info = this._method("info", 2);
    this.warn = this._method("warn", 1);
    this.debug = this._method("debug", 3);
  }
  _method(type, level) {
    return (...args) => {
      if (args.length === 1 && args[0] instanceof Error) {
        if (args[0].cause)
          this[type](args[0].cause);
        else if (isAggregateError(args[0])) {
          args[0].errors.forEach((error) => this[type](error));
          return;
        }
      }
      const sn = ++this.service._snMessage;
      const ts = Date.now();
      for (const exporter of this.service.exporters.values()) {
        if ((exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 2) < level)
          continue;
        const message = {
          sn,
          ts,
          type,
          level,
          name: this.name,
          ...this.meta,
          args
        };
        exporter.export(message);
      }
    };
  }
};
var c16 = [
  6,
  2,
  3,
  4,
  5,
  1
];
var c256 = [
  20,
  21,
  26,
  27,
  32,
  33,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  56,
  57,
  62,
  63,
  68,
  69,
  74,
  75,
  76,
  77,
  78,
  79,
  80,
  81,
  92,
  93,
  98,
  99,
  112,
  113,
  129,
  134,
  135,
  148,
  149,
  160,
  161,
  162,
  163,
  164,
  165,
  166,
  167,
  168,
  169,
  170,
  171,
  172,
  173,
  178,
  179,
  184,
  185,
  196,
  197,
  198,
  199,
  200,
  201,
  202,
  203,
  204,
  205,
  206,
  207,
  208,
  209,
  214,
  215,
  220,
  221
];
var LoggerService = class LoggerService {
  bufferSize = 1000;
  buffer = [];
  ctx;
  _snMessage = 0;
  _snExporter = 0;
  exporters = /* @__PURE__ */ new Map;
  constructor(ctx) {
    const tracker = {
      property: "ctx",
      noShadow: true
    };
    const self = createCallable("logger", joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
    Object.assign(self, this);
    self.ctx = ctx;
    defineProperty(self, symbols.tracker, tracker);
    self.exporter({
      colors: 3,
      export: (message) => {
        self.buffer.push(message);
        const overflow = self.buffer.length - self.bufferSize;
        if (overflow === 1)
          self.buffer.shift();
        else if (overflow > 1)
          self.buffer.splice(0, overflow);
      }
    });
    return self;
  }
  exporter(exporter) {
    return this.ctx.effect(() => {
      const id = ++this._snExporter;
      this.exporters.set(id, exporter);
      return () => this.exporters.delete(id);
    }, "ctx.logger.exporter()");
  }
  _resolveConfig() {
    let intercept = this.ctx[symbols.intercept];
    const configs = [];
    while ("logger" in intercept) {
      if (Object.hasOwn(intercept, "logger"))
        configs.unshift(intercept["logger"]);
      intercept = Object.getPrototypeOf(intercept);
    }
    return Object.assign({}, ...configs);
  }
  [symbols.invoke](name) {
    const config = this._resolveConfig();
    const fiber = (this[symbols.caller] ?? this.ctx).fiber;
    name ??= config.name;
    name ??= hyphenate(fiber.name);
    return new Logger({
      name,
      level: config.level,
      meta: { fiber: new WeakRef(fiber) }
    }, this);
  }
  static {
    for (const type of [
      "error",
      "info",
      "warn",
      "debug"
    ])
      LoggerService.prototype[type] = function(...args) {
        return this()[type](...args);
      };
  }
};
function enhanceError(error) {
  const lines = error.stack.split(`
`);
  lines.splice(0, 2, `Error: ${error.message}`);
  error.stack = lines.join(`
`);
  return error;
}
var RESERVED_WORDS = ["prototype", "then"];
function isSpecialProperty(prop) {
  return typeof prop === "symbol" || RESERVED_WORDS.includes(prop) || parseInt(prop).toString() === prop || prop.startsWith("_");
}
var ReflectService = class {
  ctx;
  static handler = {
    get: (target, prop, ctx) => {
      if (isSpecialProperty(prop))
        return Reflect.get(target, prop, ctx);
      if (Reflect.has(target, prop))
        return getTraceable(ctx, Reflect.get(target, prop, ctx));
      const error = /* @__PURE__ */ new Error(`cannot get property "${prop}" without inject`);
      try {
        const def = target.reflect.props[prop];
        if (def?.type === "accessor")
          return def.get.call(ctx, ctx[symbols.receiver], error);
        const defSite = ctx[symbols.shadow] ?? ctx;
        if (!defSite.fiber.runtime)
          return ctx.reflect.get(prop, false);
        return ctx.events.waterfall("internal/get", ctx, prop, error, () => {
          const key = defSite[symbols.isolate][prop];
          let fiber = defSite.fiber;
          while (true) {
            let impl = fiber.committed?.[prop];
            for (const provision of fiber.provisions)
              if (provision.name === prop && provision.ctx[symbols.isolate][prop] === key)
                impl = provision;
            if (impl)
              return getTraceable(ctx, impl.value);
            if (prop in fiber.inject) {
              error.message = `cannot get required service "${prop}" in inactive context`;
              throw error;
            }
            if (!fiber.runtime)
              throw error;
            if (fiber.parent[symbols.isolate][prop] !== key)
              throw error;
            fiber = fiber.parent.fiber;
          }
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    },
    set: (target, prop, value, ctx) => {
      if (isSpecialProperty(prop))
        return Reflect.set(target, prop, value, ctx);
      const error = /* @__PURE__ */ new Error(`cannot set property "${prop}" without provide`);
      const def = target.reflect.props[prop];
      if (!def) {
        if (!ctx.fiber.runtime)
          return Reflect.set(target, prop, value, ctx);
        throw enhanceError(error);
      }
      try {
        if (def.type === "accessor") {
          if (!def.set)
            return false;
          return def.set.call(ctx, value, ctx[symbols.receiver], error);
        }
        return ctx.events.waterfall("internal/set", ctx, prop, value, error, () => {
          return ctx.reflect.set(prop, value, error);
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    },
    has: (target, prop) => {
      if (isSpecialProperty(prop))
        return Reflect.has(target, prop);
      if (Reflect.has(target, prop))
        return true;
      return !!target.reflect.props[prop];
    }
  };
  store = Object.create(null);
  props = Object.create(null);
  _implCounter = 0;
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
    this.mixin("reflect", [
      "get",
      "set",
      "provide",
      "accessor",
      "mixin"
    ]);
    this.mixin("fiber", ["runtime", "effect"]);
    this.mixin("registry", ["inject", "plugin"]);
    this.mixin("events", [
      "on",
      "once",
      "parallel",
      "emit",
      "serial",
      "bail",
      "waterfall"
    ]);
  }
  get(name, strict = true) {
    return getTraceable(this.ctx, this._getImpl(name, strict)?.value);
  }
  _getImpl(name, strict = true) {
    const key = this.ctx[symbols.isolate][name];
    const impl = key && this.store[key];
    if (!impl)
      return;
    if (strict && impl.ctx.fiber.state !== 2)
      return;
    return impl;
  }
  set(name, value, error) {
    const key = this.ctx[symbols.isolate][name];
    const impl = this.store[key];
    if (!impl)
      throw new Error(`cannot set property "${name}" without provide`);
    if (impl.ctx.fiber !== this.ctx.fiber)
      throw new Error(`cannot set property "${name}" in multiple fibers`);
    impl.value = value;
    return true;
  }
  provide(name, value, check) {
    return this.ctx.fiber.effect(() => {
      if (!this.props[name])
        this.props[name] ??= { type: "service" };
      else if (this.props[name].type !== "service")
        throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
      this.props[name] = { type: "service" };
      this.ctx.root[symbols.isolate][name] ??= Symbol(name);
      const key = this.ctx[symbols.isolate][name];
      const impl = {
        uid: ++this._implCounter,
        name,
        value,
        ctx: this.ctx,
        check,
        isolate: key,
        dependents: /* @__PURE__ */ new Set
      };
      if (this.store[key])
        throw new Error(`service "${name}" has been registered at <${this.store[key].ctx.fiber.name}>`);
      this.store[key] = impl;
      this.ctx.fiber.provisions.add(impl);
      if (this.ctx.fiber.state === 2)
        this.notify([name]);
      return async () => {
        if (this.store[impl.isolate] === impl)
          delete this.store[impl.isolate];
        this.ctx.isolate(name, impl.isolate).reflect.notify([name]);
        await new Promise((resolve) => {
          impl.release = resolve;
          if (!impl.dependents.size)
            resolve();
        });
        impl.release = undefined;
        this.ctx.fiber.provisions.delete(impl);
      };
    }, `ctx.provide(${JSON.stringify(name)})`);
  }
  notify(names, filter = (ctx, name) => ctx[symbols.isolate][name] === this.ctx[symbols.isolate][name]) {
    for (const runtime of this.ctx.registry.values())
      for (const fiber of runtime.fibers) {
        let hasUpdate = false;
        for (const name of names) {
          if (!(name in fiber.inject))
            continue;
          if (!filter(fiber.ctx, name))
            continue;
          hasUpdate = true;
          fiber._checkImpl(name);
        }
        if (!hasUpdate)
          continue;
        fiber._refresh();
      }
    for (const name of names) {
      const self = Object.create(this.ctx);
      self[symbols.filter] = (target) => filter(target, name);
      this.ctx.events.emit(self, "internal/service", name, this._getImpl(name, false)?.value);
    }
  }
  accessor(name, options) {
    return this.ctx.fiber.effect(() => {
      if (name in this.props)
        throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
      this.props[name] = {
        type: "accessor",
        ...options
      };
      return () => delete this.props[name];
    }, `ctx.accessor(${JSON.stringify(name)})`);
  }
  mixin(source, mixins) {
    const self = this;
    return this.ctx.fiber.effect(function* () {
      const entries = Array.isArray(mixins) ? mixins.map((key) => [key, key]) : Object.entries(mixins);
      const getTarget = (ctx, error) => {
        return ctx[source];
      };
      for (const [key, value] of entries)
        yield self.accessor(value, {
          get(receiver, error) {
            const service = getTarget(this, error);
            if (isNullable(service))
              return service;
            const mixin = receiver ? withProps(receiver, service) : service;
            const value = Reflect.get(service, key, mixin);
            if (typeof value !== "function")
              return value;
            return value.bind(mixin ?? service);
          },
          set(value, receiver, error) {
            const service = getTarget(this, error);
            const mixin = receiver ? withProps(receiver, service) : service;
            return Reflect.set(service, key, value, mixin);
          }
        });
    }, `ctx.mixin(${JSON.stringify(source)})`);
  }
  trace(value) {
    return getTraceable(this.ctx, value);
  }
  bind(callback) {
    return new Proxy(callback, {
      apply: (target, thisArg, args) => {
        return Reflect.apply(target, this.trace(thisArg), args.map((arg) => this.trace(arg)));
      },
      construct: (target, args, newTarget) => {
        return Reflect.construct(target, args.map((arg) => this.trace(arg)), newTarget);
      }
    });
  }
};
function isApplicable(object) {
  return object && typeof object === "object" && typeof object.apply === "function";
}
function Inject(name, config) {
  return function(value, decorator) {
    if (decorator.kind === "class") {
      if (!Object.hasOwn(value, "inject")) {
        defineProperty(value, "inject", Object.create(Object.getPrototypeOf(value).inject ?? null));
        defineProperty(value.inject, symbols.checkProto, true);
      }
      value.inject[name] = config;
    } else if (decorator.kind === "method") {
      const inject = (value[symbols.metadata] ??= {}).inject ??= Object.create(null);
      inject[name] = config;
      decorator.addInitializer(function() {
        const property = this[symbols.tracker]?.property;
        (this[symbols.initHooks] ??= []).push(() => {
          this.ctx.inject(inject, (ctx) => {
            return value.call(property ? withProps(this, { [property]: ctx }) : this);
          });
        });
      });
    } else
      throw new Error("@Inject() can only be used on class or class methods");
  };
}
(function(Inject) {
  function resolve(inject, result = Object.create(null)) {
    if (!inject)
      return result;
    if (Array.isArray(inject))
      for (const name of inject)
        result[name] = null;
    else if (Reflect.has(inject, symbols.checkProto)) {
      Object.assign(result, resolve(Object.getPrototypeOf(inject)));
      for (const name of Object.keys(inject))
        result[name] = inject[name] ?? null;
    } else
      for (const name of Object.keys(inject))
        result[name] = inject[name] ?? null;
    return result;
  }
  Inject.resolve = resolve;
})(Inject || (Inject = {}));
var RegistryService = class {
  ctx;
  _counter = 0;
  _internal = /* @__PURE__ */ new Map;
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
  }
  get counter() {
    return ++this._counter;
  }
  get size() {
    return this._internal.size;
  }
  resolve(plugin) {
    try {
      if (typeof plugin === "function")
        return plugin;
      if (isApplicable(plugin))
        return plugin.apply;
    } catch {}
  }
  get(plugin) {
    const key = this.resolve(plugin);
    return key && this._internal.get(key);
  }
  has(plugin) {
    const key = this.resolve(plugin);
    return !!key && this._internal.has(key);
  }
  delete(plugin) {
    const key = this.resolve(plugin);
    const runtime = key && this._internal.get(key);
    if (!runtime)
      return;
    this._internal.delete(key);
    for (const fiber of runtime.fibers)
      fiber.dispose();
    return runtime;
  }
  keys() {
    return this._internal.keys();
  }
  values() {
    return this._internal.values();
  }
  entries() {
    return this._internal.entries();
  }
  forEach(callback) {
    return this._internal.forEach(callback);
  }
  inject(inject, callback) {
    return this.plugin({
      inject,
      apply: callback,
      name: callback.name
    });
  }
  plugin(plugin, config, getOuterStack = buildOuterStack()) {
    const callback = this.resolve(plugin);
    if (!callback)
      throw new Error('invalid plugin, expect function or object with an "apply" method, received ' + typeof plugin);
    this.ctx.fiber.assertActive();
    let runtime = this._internal.get(callback);
    if (!runtime) {
      let name = plugin.name;
      if (name === "apply")
        name = undefined;
      runtime = {
        name,
        callback,
        fibers: new DisposableList,
        Config: plugin.Config
      };
      this._internal.set(callback, runtime);
    }
    const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
    const wrapped = Object.create(fiber);
    wrapped.then = (onFulfilled, onRejected) => {
      return fiber.await().then(onFulfilled, onRejected);
    };
    return wrapped;
  }
};
var Context = class Context {
  static effect = symbols.effect;
  static filter = symbols.filter;
  static isolate = symbols.isolate;
  static intercept = symbols.intercept;
  static is(value) {
    return !!value?.[Context.is];
  }
  static {
    Context.is[Symbol.toPrimitive] = () => Symbol.for("cordis.is");
    Context.prototype[Context.is] = true;
  }
  constructor() {
    this[symbols.isolate] = Object.create(null);
    this[symbols.intercept] = Object.create(null);
    const self = new Proxy(this, ReflectService.handler);
    this.root = self;
    this.baseUrl = undefined;
    this.fiber = new Fiber(self, {}, Object.create(null), null, () => []);
    this.reflect = new ReflectService(self);
    this.registry = new RegistryService(self);
    this.events = new EventsService(self);
    this.logger = new LoggerService(self);
    this.fiber._disposables.clear();
    return self;
  }
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return `Context <${this.fiber.name}>`;
  }
  extend(meta = {}) {
    const shadow = Reflect.getOwnPropertyDescriptor(this, symbols.shadow)?.value;
    const self = Object.create(getTraceable(this, this));
    for (const prop of Reflect.ownKeys(meta))
      Object.defineProperty(self, prop, Reflect.getOwnPropertyDescriptor(meta, prop));
    if (!shadow)
      return self;
    return Object.assign(Object.create(self), { [symbols.shadow]: shadow });
  }
  isolate(name, label) {
    const shadow = Object.create(this[symbols.isolate]);
    shadow[name] = label ?? Symbol(name);
    return this.extend({ [symbols.isolate]: shadow });
  }
  intercept(name, config) {
    const intercept = Object.create(this[symbols.intercept]);
    intercept[name] = config;
    return this.extend({ [symbols.intercept]: intercept });
  }
};
var Service = class Service {
  ctx;
  static init = symbols.init;
  static check = symbols.check;
  static config = symbols.config;
  static invoke = symbols.invoke;
  static extend = symbols.extend;
  static tracker = symbols.tracker;
  static resolveConfig = symbols.resolveConfig;
  name;
  constructor(ctx, name) {
    this.ctx = ctx;
    name ??= this.constructor["provide"];
    let self = this;
    const tracker = {
      associate: name,
      property: "ctx"
    };
    if (self[symbols.invoke])
      self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
    self.ctx = ctx;
    self.name = name;
    defineProperty(self, symbols.tracker, tracker);
    self.ctx.reflect.provide(name, self, this[symbols.check]);
    return self;
  }
  [symbols.filter](ctx) {
    return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name];
  }
  [symbols.extend](props) {
    let self;
    if (this[Service.invoke])
      self = createCallable(this.name, this, this[symbols.tracker]);
    else
      self = Object.create(this);
    return Object.assign(self, props);
  }
  [symbols.resolveConfig](base, head) {
    let intercept = this.ctx[Context.intercept];
    const configs = [];
    while (this.name in intercept) {
      if (Object.hasOwn(intercept, this.name))
        configs.unshift(intercept[this.name]);
      intercept = Object.getPrototypeOf(intercept);
    }
    if (base)
      configs.unshift(base);
    if (head)
      configs.push(head);
    if (this["Config"]?.merge)
      return this["Config"].merge(...configs);
    else
      return Object.assign({}, ...configs);
  }
  static [Symbol.hasInstance](instance) {
    if (!instance)
      return false;
    let constructor = instance.constructor;
    while (constructor) {
      constructor = constructor.prototype?.constructor;
      if (constructor === this)
        return true;
      constructor &&= Object.getPrototypeOf(constructor);
    }
    return false;
  }
};

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
var RemoteError = class extends Error {
  code;
  details;
  isDSHRemoteError = true;
  constructor(code, message, details, options) {
    super(message, options);
    this.code = code;
    this.details = details;
    this.name = "RemoteError";
  }
};
var TYPERT_OWNED_VALUE = Symbol.for("dsh.typert.owned-value");
var TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
function isTypertRemoteSegment(value) {
  return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
var REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
function bindTypertRemote(service, serviceKey, options = {}) {
  validateName("service key", serviceKey);
  const namespace = options.namespace ?? serviceKey;
  validateName("namespace", namespace);
  const ctx = Reflect.get(service, "ctx");
  if (Context.is(ctx))
    provideInvocationAccessor(ctx);
  return Object.freeze({
    service,
    serviceKey,
    namespace
  });
}
var TypertRemoteService = class extends Service {
  typertRemote;
  constructor(ctx, serviceKey, options = {}) {
    super(ctx, serviceKey);
    this.typertRemote = bindTypertRemote(this, this.name, options);
  }
};
function provideInvocationAccessor(ctx) {
  if (Object.hasOwn(ctx.root.reflect.props, "invocation"))
    return;
  ctx.root.accessor("invocation", { get: () => {
    return;
  } });
}
function Remote(methodExportOrOptions, context) {
  if (typeof methodExportOrOptions === "string") {
    validateName("Remote export name", methodExportOrOptions);
    return remoteDecorator({ kind: "direct" }, { exportName: methodExportOrOptions });
  }
  if (typeof methodExportOrOptions === "object")
    return remoteDecorator({ kind: "direct" }, markerOptions(methodExportOrOptions, REMOTE_OPTION_KEYS, 'Remote options require name, mode: "stream", or resources'));
  if (context === undefined)
    throw new TypeError("typert-protocol: Remote decorator context is missing");
  addMarkerInitializer(context, { kind: "direct" });
}
var REMOTE_OPTION_KEYS = new Set([
  "name",
  "mode",
  "resources"
]);
var REMOTE_SCOPE_OPTION_KEYS = new Set(["name", "resources"]);
function markerOptions(options, accepted, requirement) {
  const keys = Reflect.ownKeys(options);
  if (keys.length === 0 || keys.some((key) => typeof key !== "string" || !accepted.has(key)) || Object.hasOwn(options, "mode") && options.mode !== "stream")
    throw new TypeError(`typert-protocol: ${requirement}`);
  const { mode, name, resources } = options;
  if (name !== undefined)
    validateName("Remote export name", name);
  return {
    ...mode === undefined ? {} : { mode },
    ...name === undefined ? {} : { exportName: name },
    ...resources === undefined ? {} : { resources: resourceReaders(resources) }
  };
}
function resourceReaders(resources) {
  const readers = {};
  for (const [kind, reader] of Object.entries(resources)) {
    if (typeof reader !== "function")
      throw new TypeError(`typert-protocol: Remote resource reader "${kind}" must be a function`);
    readers[kind] = reader;
  }
  if (Object.keys(readers).length === 0)
    throw new TypeError("typert-protocol: Remote resources require at least one reader");
  return Object.freeze(readers);
}
function remoteDecorator(invocation, options = {}) {
  return function(_method, context) {
    addMarkerInitializer(context, invocation, options);
  };
}
function readRemoteMethodDescriptor(prototype) {
  const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
  if (property === undefined)
    return;
  const descriptor = property.value;
  if (descriptor === null || typeof descriptor !== "object")
    throw new TypeError("typert-protocol: Remote method descriptor must be an object");
  const version = Reflect.get(descriptor, "version");
  if (version !== 1)
    throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version)}`);
  const methods = Reflect.get(descriptor, "methods");
  if (!Array.isArray(methods))
    throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
  return descriptor;
}
function addMarkerInitializer(context, invocation, options = {}) {
  if (context.private || context.static || typeof context.name !== "string")
    throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
  const method = context.name;
  context.addInitializer(function() {
    const prototype = Object.getPrototypeOf(this);
    if (prototype === null)
      throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
    mark(prototype, method, invocation, options);
  });
}
function mark(prototype, method, invocation, { mode, exportName, resources }) {
  const descriptor = readRemoteMethodDescriptor(prototype);
  const marker = Object.freeze({
    method,
    ...exportName === undefined || exportName === method ? {} : { exportName },
    ...mode === undefined ? {} : { mode },
    invocation: Object.freeze(invocation),
    ...resources === undefined ? {} : { resources }
  });
  const current = descriptor?.methods.find((candidate) => candidate.method === method);
  if (current !== undefined) {
    if (current.exportName === marker.exportName && current.mode === marker.mode && current.resources === marker.resources && sameInvocation(current.invocation, invocation))
      return;
    throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
  }
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze([...descriptor?.methods ?? [], marker])
    })
  });
}
function sameInvocation(left, right) {
  if (left.kind === "direct")
    return right.kind === "direct";
  if (right.kind === "direct")
    return false;
  return left.context === right.context;
}
function validateName(subject, value) {
  if (!isTypertRemoteSegment(value))
    throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}

// src/host/lsp/client.ts
import { spawn } from "node:child_process";
import { EventEmitter as EventEmitter2 } from "node:events";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

// src/host/lsp/protocol.ts
import { EventEmitter } from "node:events";
function encodeMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`;
}

class LspFrameParser extends EventEmitter {
  buffer = "";
  push(chunk) {
    this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    for (;; ) {
      const boundary = /\r\n\r\n|\n\n/.exec(this.buffer);
      if (!boundary)
        return;
      const headerEnd = boundary.index;
      const separatorSize = boundary[0].length;
      const lengthMatch = /content-length:\s*(\d+)/i.exec(this.buffer.slice(0, headerEnd));
      const headerSize = headerEnd + separatorSize;
      if (!lengthMatch) {
        this.buffer = this.buffer.slice(headerSize);
        continue;
      }
      const length = Number(lengthMatch[1]);
      if (this.buffer.length < headerSize + length)
        return;
      const body = this.buffer.slice(headerSize, headerSize + length);
      this.buffer = this.buffer.slice(headerSize + length);
      try {
        const message = JSON.parse(body);
        this.emit("message", message);
      } catch (error) {
        this.emit("parse-error", error);
      }
    }
  }
}

// src/host/lsp/client.ts
var require2 = createRequire(import.meta.url);
var CONTENT_KIND = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"]);
function resolveLanguageServerCommand() {
  const cliPath = require2.resolve("typescript-language-server/lib/cli.mjs");
  return { executable: process.execPath, args: [cliPath, "--stdio"] };
}

class LspClient extends EventEmitter2 {
  rootPath;
  rootUri;
  process = null;
  parser = new LspFrameParser;
  nextId = 1;
  pending = new Map;
  documents = new Map;
  diagnostics = new Map;
  logger;
  requestTimeoutMs;
  initializeError = null;
  shutdownRequested = false;
  command;
  args;
  env;
  nodeExecutable;
  capabilities = {};
  constructor(options) {
    super();
    this.rootPath = options.rootPath;
    this.rootUri = pathToUri(options.rootPath);
    this.logger = options.logger;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120000;
    this.command = options.command ?? resolveLanguageServerCommand().executable;
    this.args = options.args ?? resolveLanguageServerCommand().args;
    this.env = options.env;
    this.nodeExecutable = options.nodeExecutable;
    this.parser.on("message", (message) => this.handleMessage(message));
    this.parser.on("parse-error", (error) => this.logger?.warn?.(`lsp frame parse error: ${String(error)}`));
  }
  async start() {
    if (this.process)
      return this.capabilities;
    const executable = this.nodeExecutable ?? this.command;
    this.logger?.debug?.(`spawning language server: ${executable} ${this.args.join(" ")}`);
    const child = spawn(executable, this.args, {
      cwd: this.rootPath,
      env: this.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.process = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.parser.push(chunk));
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text.length > 0)
        this.logger?.debug?.(`language server stderr: ${text}`);
    });
    child.on("exit", (code, signal) => {
      const error = this.initializeError ?? new Error(`language server exited (code ${code}, signal ${signal})`);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.process = null;
      if (!this.shutdownRequested)
        this.emit("exit", code, signal);
    });
    const result = await this.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "dsh-code-intel", version: "0.2.0" },
      locale: "en",
      rootPath: this.rootPath,
      rootUri: this.rootUri,
      workspaceFolders: [{ name: "workspace", uri: this.rootUri }],
      capabilities: {
        textDocument: {
          synchronization: { openClose: true, change: 1, willSave: false, save: false },
          hover: { dynamicRegistration: false, contentFormat: ["markdown", "plaintext"] },
          documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          implementation: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: false, versionSupport: false }
        },
        workspace: {
          symbol: { dynamicRegistration: false, resolveProvider: true }
        }
      }
    });
    this.capabilities = result.capabilities ?? {};
    this.notify("initialized", {});
    return this.capabilities;
  }
  async stop() {
    const child = this.process;
    if (!child)
      return;
    this.shutdownRequested = true;
    try {
      await this.request("shutdown", undefined, 5000);
      this.notify("exit", undefined);
    } catch {}
    child.kill("SIGKILL");
    this.process = null;
    this.documents.clear();
    this.diagnostics.clear();
  }
  get running() {
    return this.process !== null && !this.process.killed;
  }
  onExit(listener) {
    this.on("exit", listener);
    return { dispose: () => this.off("exit", listener) };
  }
  request(method, params, timeoutMs) {
    const child = this.process;
    if (!child)
      return Promise.reject(new Error("language server is not started"));
    const id = this.nextId++;
    const message = encodeMessage({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`lsp request timed out after ${timeoutMs ?? this.requestTimeoutMs}ms: ${method}`));
      }, timeoutMs ?? this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(message);
    });
  }
  notify(method, params) {
    if (!this.process)
      return;
    this.process.stdin.write(encodeMessage({ jsonrpc: "2.0", method, params }));
  }
  handleMessage(message) {
    if ("id" in message && (("result" in message) || ("error" in message))) {
      const response = message;
      const pending = this.pending.get(response.id);
      if (!pending)
        return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      if (response.error) {
        pending.reject(new Error(`lsp error ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
      return;
    }
    if ("method" in message) {
      const notification = message;
      if (notification.method === "textDocument/publishDiagnostics") {
        const params = notification.params;
        this.diagnostics.set(params.uri, params.diagnostics ?? []);
        this.emit("diagnostics", { uri: params.uri, diagnostics: params.diagnostics ?? [] });
        return;
      }
      if (notification.method === "window/logMessage" || notification.method === "window/showMessage") {
        this.logger?.debug?.(`lsp ${notification.method}`);
        return;
      }
      this.emit("notification", notification);
    }
  }
  get openDocuments() {
    return this.documents;
  }
  openTextDocument(uri, languageId, text, version = 1) {
    this.documents.set(uri, { text, version });
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text }
    });
  }
  changeTextDocument(uri, text, version) {
    this.documents.set(uri, { text, version });
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }]
    });
  }
  closeTextDocument(uri) {
    if (!this.documents.delete(uri))
      return;
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }
  getDiagnostics(uri) {
    return this.diagnostics.get(uri) ?? [];
  }
  *allDiagnostics() {
    for (const [uri, diagnostics] of this.diagnostics) {
      if (diagnostics.length > 0)
        yield { uri, diagnostics };
    }
  }
  async documentSymbol(uri) {
    const result = await this.request("textDocument/documentSymbol", { textDocument: { uri } });
    if (!result)
      return [];
    return "range" in result[0] ? result : this.forestFromFlat(result);
  }
  async workspaceSymbol(query) {
    const result = await this.request("workspace/symbol", { query });
    return result ?? [];
  }
  async references(uri, position, includeDeclaration = true) {
    const result = await this.request("textDocument/references", {
      textDocument: { uri },
      position,
      context: { includeDeclaration }
    });
    return result ?? [];
  }
  async definition(uri, position) {
    const result = await this.request("textDocument/definition", {
      textDocument: { uri },
      position
    });
    if (!result)
      return [];
    return Array.isArray(result) ? result : [result];
  }
  async implementation(uri, position) {
    const result = await this.request("textDocument/implementation", {
      textDocument: { uri },
      position
    });
    if (!result)
      return [];
    return Array.isArray(result) ? result : [result];
  }
  async hover(uri, position) {
    return await this.request("textDocument/hover", {
      textDocument: { uri },
      position
    });
  }
  forestFromFlat(flat) {
    const byContainer = new Map;
    for (const symbol of flat) {
      const list = byContainer.get(symbol.containerName) ?? [];
      list.push(symbol);
      byContainer.set(symbol.containerName, list);
    }
    const toDocumentSymbol = (symbol) => {
      const children = (byContainer.get(symbol.name) ?? []).map(toDocumentSymbol);
      return {
        name: symbol.name,
        kind: symbol.kind,
        range: symbol.location.range,
        selectionRange: symbol.location.range,
        children: children.length > 0 ? children : undefined
      };
    };
    return (byContainer.get(undefined) ?? []).map(toDocumentSymbol);
  }
}
function pathToUri(path) {
  return pathToFileURL(path).toString();
}
function uriToPath(uri) {
  return fileURLToPath(uri);
}
function languageIdOf(path) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  switch (extension) {
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    default:
      return CONTENT_KIND.has(extension) ? "typescript" : null;
  }
}
function hoverText(hover) {
  if (!hover)
    return null;
  const contents = hover.contents;
  if (typeof contents === "string")
    return contents;
  if (Array.isArray(contents))
    return contents.map((content) => content.value).join(`

`);
  return contents.value;
}

// src/host/graph/store.ts
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
var GRAPH_SCHEMA_VERSION = 1;

class GraphStore {
  cachePath;
  constructor(rootPath, options = {}) {
    const base = options.cacheDir ?? process.env.DSH_CODE_INTEL_CACHE ?? join(homedir(), ".dsh", "code-intel", "caches");
    const stamp = createHash("sha1").update(rootPath).digest("hex").slice(0, 16);
    this.cachePath = join(base, stamp, "graph.json");
  }
  async save(data) {
    await mkdir(dirname(this.cachePath), { recursive: true });
    const staging = `${this.cachePath}.tmp`;
    await writeFile(staging, JSON.stringify(data), "utf8");
    await rename(staging, this.cachePath);
  }
  async load() {
    try {
      const raw = await readFile(this.cachePath, "utf8");
      const data = JSON.parse(raw);
      if (data.version !== GRAPH_SCHEMA_VERSION)
        return null;
      return data;
    } catch {
      return null;
    }
  }
  async isFresh(maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const stats = await stat(this.cachePath);
      return stats.isFile() && Date.now() - stats.mtimeMs < maxAgeMs;
    } catch {
      return false;
    }
  }
}

// src/host/graph/model.ts
class SymbolGraph {
  data;
  constructor(data) {
    this.data = data;
  }
  get rootPath() {
    return this.data.rootPath;
  }
  get files() {
    return new Map(Object.entries(this.data.files));
  }
  get symbols() {
    return new Map(Object.entries(this.data.symbols));
  }
  file(fileId) {
    return this.data.files[fileId];
  }
  symbol(symbolId) {
    return this.data.symbols[symbolId];
  }
  symbolsOfFile(fileId) {
    return Object.values(this.data.symbols).filter((symbol) => symbol.fileId === fileId).sort((a, b) => a.startLine - b.startLine || a.startColumn - b.startColumn);
  }
  findByNamePath(namePath, relativePath) {
    const candidates = Object.values(this.data.symbols).filter((symbol) => symbol.namePath === namePath);
    if (relativePath) {
      const exact = candidates.find((symbol) => symbol.fileId === relativePath);
      if (exact)
        return exact;
    }
    if (candidates.length > 0)
      return candidates[0];
    const segments = namePath.split(".").filter((segment) => segment.length > 0);
    for (let length = segments.length - 1;length > 0; length--) {
      const suffix = segments.slice(-length).join(".");
      const hit = Object.values(this.data.symbols).find((symbol) => symbol.namePath === suffix);
      if (hit)
        return hit;
    }
    return;
  }
  lookup(namePathPattern, options = {}) {
    const substring = options.substring ?? false;
    const maxMatches = options.maxMatches ?? -1;
    const hits = [];
    const pattern = substring ? namePathPattern.toLowerCase() : namePathPattern;
    for (const symbol of Object.values(this.data.symbols)) {
      if (options.relativePath && symbol.fileId !== options.relativePath)
        continue;
      if (options.includeKinds && !options.includeKinds.includes(symbol.kind))
        continue;
      if (options.excludeKinds && options.excludeKinds.includes(symbol.kind))
        continue;
      const matches = substring ? symbol.namePath.toLowerCase().includes(pattern) : symbol.namePath === pattern || symbol.namePath.endsWith("." + pattern);
      if (!matches)
        continue;
      hits.push(toSymbolHit(symbol));
      if (maxMatches > 0 && hits.length >= maxMatches)
        break;
    }
    return hits;
  }
  overview(fileId, depth = -1) {
    const file = this.data.files[fileId];
    if (!file)
      return [];
    const symbols = this.symbolsOfFile(fileId);
    const childrenOf = new Map;
    for (const symbol of symbols) {
      const list = childrenOf.get(symbol.containerId) ?? [];
      list.push(symbol);
      childrenOf.set(symbol.containerId, list);
    }
    const build = (parentId, remaining) => (childrenOf.get(parentId) ?? []).map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      kindName: symbol.kindName,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      exported: symbol.exported,
      detail: symbol.detail,
      children: remaining !== 0 ? build(symbol.id, remaining === -1 ? -1 : remaining - 1) : []
    }));
    const effectiveDepth = depth === -1 ? defaultDepth(file.language) : depth;
    return build(null, effectiveDepth);
  }
  countsByKind() {
    const counts = {};
    for (const symbol of Object.values(this.data.symbols)) {
      counts[symbol.kindName] = (counts[symbol.kindName] ?? 0) + 1;
    }
    return counts;
  }
}
function defaultDepth(language) {
  return language.startsWith("typescript") || language.startsWith("javascript") ? 1 : 0;
}
function toSymbolHit(symbol) {
  return {
    id: symbol.id,
    name: symbol.name,
    namePath: symbol.namePath,
    kind: symbol.kind,
    kindName: symbol.kindName,
    file: symbol.fileId,
    startLine: symbol.startLine,
    startColumn: symbol.startColumn,
    endLine: symbol.endLine,
    endColumn: symbol.endColumn,
    exported: symbol.exported,
    async: symbol.async,
    static: symbol.static,
    detail: symbol.detail
  };
}

// src/host/graph/indexer.ts
import { readFile as readFile3 } from "node:fs/promises";
import { join as join3 } from "node:path";

// src/host/graph/imports.ts
var SPECIFIER_RE = /(?:^\s*import\s[^;]*?\sfrom\s*|^\s*import\s*\(|\brequire\s*\(|^\s*export\s[^;]*?\sfrom\s*)['"]([^'"]+)['"]/gm;
function extractSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const specifier = match[1];
    if (specifier)
      specifiers.push(specifier);
  }
  for (const match of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier && !specifiers.includes(specifier))
      specifiers.push(specifier);
  }
  return [...new Set(specifiers)];
}
function normalizeSegments(path) {
  const segments = [];
  for (const segment of path.split("/")) {
    if (segment.length === 0 || segment === ".")
      continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}
function resolveSpecifier(importerRelative, specifier, known) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/"))
    return null;
  const baseDirectory = importerRelative.includes("/") ? importerRelative.slice(0, importerRelative.lastIndexOf("/")) : "";
  const combined = specifier.startsWith("/") ? specifier : baseDirectory.length > 0 ? `${baseDirectory}/${specifier}` : specifier;
  const clean = normalizeSegments(combined);
  const candidates = [clean, `${clean}/index`];
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".d.ts"];
  for (const candidate of candidates) {
    for (const extension of extensions) {
      if (known.has(candidate + extension))
        return candidate + extension;
    }
  }
  return null;
}
function packageNameOf(specifier) {
  if (specifier.startsWith("@")) {
    const segments = specifier.split("/");
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : specifier;
  }
  return specifier.split("/")[0] ?? specifier;
}
function analyzeImports(source, importerRelative, known) {
  const specifiers = extractSpecifiers(source);
  const resolved = [];
  const external = [];
  for (const specifier of specifiers) {
    const resolvedPath = resolveSpecifier(importerRelative, specifier, known);
    if (resolvedPath !== null) {
      if (!resolved.includes(resolvedPath))
        resolved.push(resolvedPath);
    } else if (!specifier.startsWith(".")) {
      const packageName = packageNameOf(specifier);
      if (!external.includes(packageName))
        external.push(packageName);
    } else if (!external.includes(specifier)) {
      external.push(specifier);
    }
  }
  return { specifiers, resolved, external };
}

// src/common/types.ts
var SymbolKindName = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter"
};
function symbolKindName(kind) {
  return SymbolKindName[kind] ?? "Other";
}
var DiagnosticSeverityName = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint"
};

// src/host/graph/builder.ts
function buildFileSymbols(fileId, source, forest) {
  const state = { symbols: [], exportedIds: [] };
  const lines = source.split(`
`);
  walkAssign(forest, null, "", new Set, fileId, lines, state);
  return state;
}
function walkAssign(symbols, containerId, parentPath, siblingNames, fileId, lines, state) {
  const ids = [];
  for (const symbol of symbols) {
    const namePath = parentPath.length > 0 ? `${parentPath}.${symbol.name}` : symbol.name;
    let id = `${fileId}#${namePath}`;
    if (siblingNames.has(namePath)) {
      let counter = 2;
      while (siblingNames.has(`${namePath}#${counter}`))
        counter++;
      id = `${fileId}#${namePath}#${counter}`;
    }
    siblingNames.add(namePath);
    ids.push(id);
    const declaration = declarationPrefix(lines, symbol);
    const children = symbol.children ?? [];
    const childIds = walkAssign(children, id, namePath, new Set, fileId, lines, state);
    const exported = /\bexport\b/.test(declaration);
    state.symbols.push({
      id,
      name: symbol.name,
      namePath,
      kind: symbol.kind,
      kindName: symbolKindName(symbol.kind),
      fileId,
      containerId,
      children: childIds,
      startLine: symbol.range.start.line + 1,
      startColumn: symbol.range.start.character,
      endLine: symbol.range.end.line + 1,
      endColumn: symbol.range.end.character,
      selectionLine: symbol.selectionRange.start.line + 1,
      selectionColumn: symbol.selectionRange.start.character,
      exported,
      async: /\basync\b/.test(declaration),
      static: /\bstatic\b/.test(declaration),
      detail: symbol.detail ?? null
    });
    if (exported)
      state.exportedIds.push(id);
  }
  return ids;
}
function declarationPrefix(lines, symbol) {
  const start = symbol.range.start;
  const name = symbol.selectionRange.start;
  if (start.line === name.line) {
    return lines[start.line].slice(start.character, name.character);
  }
  const parts = [];
  for (let line = start.line;line <= name.line && line < lines.length; line++) {
    const text = lines[line];
    const from = line === start.line ? start.character : 0;
    const to = line === name.line ? name.character : text.length;
    parts.push(text.slice(from, to));
  }
  return parts.join(`
`);
}

// src/host/graph/scan.ts
import { readFile as readFile2, stat as stat2 } from "node:fs/promises";
import { join as join2, relative, sep, dirname as dirname2 } from "node:path";

// src/host/graph/ignore.ts
function parsePattern(line) {
  let source = line.trim();
  if (source.length === 0 || source.startsWith("#"))
    return null;
  const negated = source.startsWith("!");
  if (negated)
    source = source.slice(1);
  source = source.replace(/(?<!\\)\s+$/, "");
  const directoryOnly = source.endsWith("/");
  if (directoryOnly)
    source = source.slice(0, -1);
  const anchored = source.startsWith("/");
  if (anchored)
    source = source.slice(1);
  if (source.length === 0)
    return null;
  return { source: line, negated, directoryOnly, anchored, segments: source.split("/") };
}
function matchSegment(segment, pattern) {
  if (!pattern.includes("*") && !pattern.includes("?") && !pattern.includes("[")) {
    return segment === pattern;
  }
  const regex = new RegExp("^" + pattern.split("").map((char) => {
    if (char === "*")
      return ".*";
    if (char === "?")
      return ".";
    if (char === ".")
      return "\\.";
    return char.replace(/[()+^$|{}\\[\]]/g, "\\$&");
  }).join("") + "$");
  return regex.test(segment);
}

class IgnoreStack {
  patterns = [];
  ancestors;
  constructor(ancestors = null) {
    this.ancestors = ancestors;
  }
  addGitignore(body) {
    for (const line of body.split(/\r?\n/)) {
      const pattern = parsePattern(line);
      if (pattern)
        this.patterns.push(pattern);
    }
  }
  addDeny(pattern) {
    const parsed = parsePattern(pattern);
    if (parsed)
      this.patterns.push(parsed);
  }
  isIgnored(segments, isDirectory) {
    const own = this.matchOwn(segments, isDirectory);
    if (own !== undefined)
      return own;
    return this.ancestors?.isIgnored(segments, isDirectory) ?? false;
  }
  matchOwn(segments, isDirectory) {
    let ignored;
    for (const pattern of this.patterns) {
      if (pattern.directoryOnly && !isDirectory)
        continue;
      if (this.matchesPattern(pattern, segments)) {
        ignored = pattern.negated ? false : true;
      }
    }
    return ignored;
  }
  matchesPattern(pattern, segments) {
    if (pattern.segments.length === 1 && !pattern.segments[0].includes("**")) {
      const target = pattern.anchored ? segments.length === 1 ? segments[0] : null : segments[segments.length - 1];
      return target !== null && matchSegment(target, pattern.segments[0]);
    }
    return this.matchGlob(pattern.segments, 0, segments, 0);
  }
  matchGlob(patternSegments, pi, segments, si) {
    while (pi < patternSegments.length) {
      const patternSegment = patternSegments[pi];
      if (patternSegment === "**") {
        if (pi === patternSegments.length - 1)
          return true;
        for (let skip = si;skip <= segments.length; skip++) {
          if (this.matchGlob(patternSegments, pi + 1, segments, skip))
            return true;
        }
        return false;
      }
      if (si >= segments.length)
        return false;
      if (!matchSegment(segments[si], patternSegment))
        return false;
      pi++;
      si++;
    }
    return si === segments.length;
  }
}

// src/host/graph/scan.ts
var DENY_DIRECTORIES = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".dsh",
  ".idea",
  ".vscode"
];
async function scanProject(root, options = {}) {
  const maxFiles = options.maxFiles ?? 20000;
  const files = [];
  const errors = [];
  const rootInfo = await stat2(root).catch(() => null);
  if (!rootInfo || !rootInfo.isDirectory()) {
    return { files, errors: [`scan root is not a directory: ${root}`] };
  }
  const rootStack = new IgnoreStack;
  for (const deny of [...DENY_DIRECTORIES, ...options.deny ?? []]) {
    rootStack.addDeny(deny);
  }
  const walk = async (directory, stack) => {
    let entries;
    try {
      const { readdir } = await import("node:fs/promises");
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(`cannot read directory ${relative(root, directory) || "."}: ${String(error)}`);
      return;
    }
    for (const entry of entries) {
      if (files.length > maxFiles) {
        errors.push(`file limit reached (${maxFiles}); scan truncated`);
        return;
      }
      const entryPath = join2(directory, entry.name);
      const relativeSegments = relative(root, entryPath).split(sep).filter((segment) => segment.length > 0);
      if (entry.isDirectory()) {
        if (stack.isIgnored(relativeSegments, true))
          continue;
        const childStack = new IgnoreStack(stack);
        const gitignore = await readFile2(join2(entryPath, ".gitignore"), "utf8").catch(() => null);
        if (options.respectGitignore !== false && gitignore !== null) {
          childStack.addGitignore(gitignore);
        }
        await walk(entryPath, childStack);
      } else if (entry.isFile()) {
        if (stack.isIgnored(relativeSegments, false))
          continue;
        const relativePath = relativeSegments.join("/");
        if (languageIdOf(relativePath) !== null) {
          files.push(relativePath);
        }
      }
    }
  };
  const rootGitignore = await readFile2(join2(root, ".gitignore"), "utf8").catch(() => null);
  if (rootGitignore !== null)
    rootStack.addGitignore(rootGitignore);
  await walk(root, rootStack);
  files.sort();
  return { files, errors };
}

// src/host/graph/indexer.ts
var OPEN_BATCH = 24;
async function indexProject(root, client, store, options = {}) {
  const allowCache = options.allowCache ?? true;
  if (allowCache) {
    const cached = await store.load();
    if (cached) {
      const fresh = await store.isFresh(options.cacheMaxAgeMs) && !await scanDiffers(root, cached, options);
      if (fresh)
        return { data: cached, fromCache: true, failed: [] };
    }
  }
  const scanned = await scanProject(root, options);
  const known = new Set(scanned.files);
  const files = {};
  const symbols = {};
  const failed = [];
  const errors = [...scanned.errors];
  for (let start = 0;start < known.size; start += OPEN_BATCH) {
    if (options.signal?.aborted)
      throw new Error("index cancelled");
    const batch = [...known].slice(start, start + OPEN_BATCH);
    await Promise.all(batch.map(async (relativePath) => {
      const absolute = join3(root, relativePath);
      const source = await readFile3(absolute, "utf8").catch((error) => {
        failed.push(relativePath);
        errors.push(`cannot read ${relativePath}: ${String(error)}`);
        return null;
      });
      if (source === null)
        return;
      const language = languageIdOf(relativePath);
      if (language === null)
        return;
      const uri = pathToUri(absolute);
      client.openTextDocument(uri, language, source);
      const forest = await client.documentSymbol(uri).catch((error) => {
        failed.push(relativePath);
        errors.push(`symbol harvest failed for ${relativePath}: ${String(error)}`);
        return [];
      });
      const built = buildFileSymbols(relativePath, source, forest);
      for (const symbol of built.symbols)
        symbols[symbol.id] = symbol;
      const analysis = analyzeImports(source, relativePath, known);
      files[relativePath] = {
        id: relativePath,
        path: relativePath,
        language,
        symbolCount: built.symbols.length,
        imports: analysis.resolved,
        externalImports: analysis.external,
        exportedSymbols: built.exportedIds,
        size: Buffer.byteLength(source, "utf8")
      };
    }));
  }
  const previous = await store.load();
  const data = {
    version: GRAPH_SCHEMA_VERSION,
    rootPath: root,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    language: "typescript",
    files,
    symbols,
    errors
  };
  await store.save(data).catch((error) => {
    errors.push(`cannot persist graph: ${String(error)}`);
  });
  return { data, fromCache: false, failed };
}
async function scanDiffers(root, cached, options) {
  const scanned = await scanProject(root, options);
  const scannedSet = new Set(scanned.files);
  if (scannedSet.size !== Object.keys(cached.files).length)
    return true;
  for (const file of scanned.files) {
    if (!cached.files[file])
      return true;
  }
  return false;
}

// src/host/blueprint.ts
function buildBlueprint(data, fromCache) {
  const files = Object.values(data.files);
  const countsByKind = {};
  for (const symbol of Object.values(data.symbols)) {
    countsByKind[symbol.kindName] = (countsByKind[symbol.kindName] ?? 0) + 1;
  }
  const dependencies = [];
  const externalCounts = new Map;
  for (const file of files) {
    for (const target of file.imports) {
      if (data.files[target])
        dependencies.push({ from: file.path, to: target });
    }
    for (const external of file.externalImports) {
      externalCounts.set(external, (externalCounts.get(external) ?? 0) + 1);
    }
  }
  const importedByCount = new Map;
  for (const edge of dependencies) {
    importedByCount.set(edge.to, (importedByCount.get(edge.to) ?? 0) + 1);
  }
  const entryPoints = files.filter((file) => (importedByCount.get(file.path) ?? 0) === 0).map((file) => file.path).sort();
  const externalDependencies = [...externalCounts.entries()].map(([name, importedBy]) => ({ name, importedBy })).sort((a, b) => b.importedBy - a.importedBy || a.name.localeCompare(b.name));
  const exportedSymbolCount = files.reduce((total, file) => total + file.exportedSymbols.length, 0);
  return {
    rootPath: data.rootPath,
    language: data.language,
    fileCount: files.length,
    symbolCount: Object.keys(data.symbols).length,
    countsByKind,
    exportedSymbolCount,
    modules: files.map((file) => ({
      path: file.path,
      language: file.language,
      symbolCount: file.symbolCount,
      exportedSymbols: namesOfExported(file, data),
      imports: file.imports,
      externalImports: file.externalImports
    })).sort((a, b) => a.path.localeCompare(b.path)),
    dependencies,
    externalDependencies,
    entryPoints,
    errors: data.errors,
    generatedAt: data.updatedAt,
    fromCache
  };
}
function namesOfExported(file, data) {
  return file.exportedSymbols.map((id) => data.symbols[id]?.namePath).filter((namePath) => Boolean(namePath)).sort();
}

// src/host/service.ts
import { readFile as readFile4 } from "node:fs/promises";
import { join as join4 } from "node:path";
async function resolveRoot(ctx, agent, signal) {
  if (agent) {
    try {
      const workingDirectory = ctx.workingDirectory;
      if (workingDirectory)
        return await workingDirectory.ensure(agent, signal);
    } catch {}
  }
  return process.cwd();
}

class CodeIntelService extends TypertRemoteService {
  contexts = new Map;
  config;
  constructor(ctx, config = {}) {
    super(ctx, "codeIntel");
    this.config = config;
  }
  async ensure(root, signal) {
    const context = this.contexts.get(root);
    if (context && context.graph)
      return context;
    if (context?.inflight)
      return context.inflight;
    const fresh = {
      root,
      lsp: new LspClient({ rootPath: root, logger: this.logger() }),
      store: new GraphStore(root),
      graph: null,
      status: { state: "indexing", rootPath: root, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: null },
      inflight: null
    };
    this.contexts.set(root, fresh);
    fresh.inflight = (async () => {
      try {
        await fresh.lsp.start();
        const outcome = await indexProject(root, fresh.lsp, fresh.store, { signal, deny: this.config.deny });
        fresh.graph = new SymbolGraph(outcome.data);
        fresh.status = {
          state: "ready",
          rootPath: root,
          fileCount: outcome.data.files ? Object.keys(outcome.data.files).length : 0,
          symbolCount: Object.keys(outcome.data.symbols).length,
          updatedAt: outcome.data.updatedAt,
          fromCache: outcome.fromCache,
          message: null
        };
      } catch (error) {
        fresh.status = { state: "error", rootPath: root, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: String(error) };
        throw error;
      } finally {
        fresh.inflight = null;
      }
      return fresh;
    })();
    return fresh.inflight;
  }
  logger() {
    const logger = this.ctx.logger("code-intel");
    return {
      debug: (message) => logger.debug(message),
      warn: (message) => logger.warn(message)
    };
  }
  async contextFor(root, agent, signal) {
    const resolved = root ?? this.config.rootPath ?? await resolveRoot(this.ctx, agent, signal);
    return this.ensure(resolved, signal);
  }
  async getBlueprint(root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    return buildBlueprint(context.graph.data, context.status.fromCache);
  }
  async status(root, agent) {
    const resolved = root ?? this.config.rootPath ?? process.cwd();
    const context = this.contexts.get(resolved);
    if (!context) {
      return { state: "idle", rootPath: resolved, fileCount: 0, symbolCount: 0, updatedAt: null, fromCache: false, message: null };
    }
    return context.status;
  }
  async getSymbolsOverview(relativePath, depth = -1, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    const entries = context.graph.overview(relativePath, depth);
    return { file: relativePath, symbols: entries, symbolCount: context.graph.symbolsOfFile(relativePath).length };
  }
  async searchSymbols(pattern, options = {}, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    return context.graph.lookup(pattern, options);
  }
  async getSymbolDetails(namePath, options = {}, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    const symbol = context.graph.findByNamePath(namePath, options.relativePath);
    if (!symbol)
      throw new Error(`symbol not found: ${namePath}`);
    const container = symbol.containerId ? context.graph.symbol(symbol.containerId) : null;
    const children = symbol.children.map((id) => context.graph.symbol(id)).filter((child) => child !== undefined).map((child) => ({ namePath: child.namePath, kindName: child.kindName }));
    const uri = pathToUri(join4(context.root, symbol.fileId));
    const hover = hoverText(await context.lsp.hover(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn }).catch(() => null));
    let body = null;
    if (options.includeBody) {
      body = await readSymbolBody(context.root, symbol.fileId, symbol.startLine, symbol.endLine);
    }
    return {
      symbol: toSymbolHit(symbol),
      container: container ? { namePath: container.namePath, kindName: container.kindName } : null,
      children,
      hover,
      body
    };
  }
  async findReferencingSymbols(namePath, options = {}, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    const symbols = options.relativePath ? context.graph.symbolsOfFile(options.relativePath).filter((symbol) => symbol.namePath === namePath) : context.graph.lookup(namePath);
    if (symbols.length === 0)
      throw new Error(`symbol not found: ${namePath}`);
    const results = [];
    for (const hit of symbols) {
      const symbol = context.graph.symbol(hit.id);
      if (!symbol)
        continue;
      const uri = pathToUri(join4(context.root, symbol.fileId));
      const locations = await context.lsp.references(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn }, true);
      const references = await Promise.all(locations.map(async (location) => {
        const file = relativePathOf(context, location.uri);
        const snippet = await readLine(context.root, file, location.range.start.line + 1);
        return {
          namePath: containerNameAt(context, file, location.range.start.line) ?? "(anonymous)",
          file,
          line: location.range.start.line + 1,
          column: location.range.start.character,
          snippet
        };
      }));
      results.push({ symbol: toSymbolHit(symbol), references });
    }
    return results;
  }
  async findImplementations(namePath, options = {}, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    if (!context.graph)
      throw new Error("code graph is not ready");
    const symbols = options.relativePath ? context.graph.symbolsOfFile(options.relativePath).filter((symbol) => symbol.namePath === namePath) : context.graph.lookup(namePath);
    if (symbols.length === 0)
      throw new Error(`symbol not found: ${namePath}`);
    const results = [];
    for (const hit of symbols) {
      const symbol = context.graph.symbol(hit.id);
      if (!symbol)
        continue;
      const uri = pathToUri(join4(context.root, symbol.fileId));
      const locations = await context.lsp.implementation(uri, { line: symbol.selectionLine - 1, character: symbol.selectionColumn });
      const implementations = locations.map((location) => ({
        namePath: containerNameAt(context, relativePathOf(context, location.uri), location.range.start.line) ?? "(anonymous)",
        file: relativePathOf(context, location.uri),
        line: location.range.start.line + 1,
        column: location.range.start.character
      }));
      results.push({ symbol: toSymbolHit(symbol), implementations });
    }
    return results;
  }
  async getDiagnostics(relativePath, root, agent, signal) {
    const context = await this.contextFor(root, agent, signal);
    const collect = async (file) => {
      const uri = pathToUri(join4(context.root, file));
      const diagnostics = await this.collectDiagnostics(context, uri);
      return {
        file,
        diagnostics: diagnostics.map((diagnostic) => ({
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character,
          endLine: diagnostic.range.end.line + 1,
          endColumn: diagnostic.range.end.character,
          severity: DiagnosticSeverityName[diagnostic.severity ?? 1] ?? "error",
          source: diagnostic.source ?? null,
          code: diagnostic.code === undefined ? null : String(diagnostic.code),
          message: diagnostic.message
        }))
      };
    };
    if (relativePath)
      return [await collect(relativePath)];
    const files = context.graph ? Object.keys(context.graph.data.files) : [];
    const withDiagnostics = [];
    for (const file of files) {
      const entry = await collect(file);
      if (entry.diagnostics.length > 0)
        withDiagnostics.push(entry);
    }
    return withDiagnostics;
  }
  async refresh(root, agent, signal) {
    const resolved = root ?? this.config.rootPath ?? await resolveRoot(this.ctx, agent, signal);
    const context = this.contexts.get(resolved);
    if (context) {
      await context.store.save(context.graph?.data ?? freshGraph(resolved)).catch(() => {
        return;
      });
      this.contexts.delete(resolved);
    }
    await this.ensure(resolved, signal);
    return this.status(resolved);
  }
  async dispose() {
    await Promise.all([...this.contexts.values()].map((context) => context.lsp.stop().catch(() => {
      return;
    })));
    this.contexts.clear();
  }
  async query(op, argsJson) {
    const args = safeParse(argsJson);
    switch (op) {
      case "blueprint":
        return JSON.stringify(await this.getBlueprint(args.root));
      case "status":
        return JSON.stringify(await this.status(args.root));
      case "overview":
        return JSON.stringify(await this.getSymbolsOverview(args.file, args.depth));
      case "search":
        return JSON.stringify(await this.searchSymbols(args.pattern, args.options));
      case "details":
        return JSON.stringify(await this.getSymbolDetails(args.namePath, args.options));
      case "references":
        return JSON.stringify(await this.findReferencingSymbols(args.namePath, args.options));
      case "implementations":
        return JSON.stringify(await this.findImplementations(args.namePath, args.options));
      case "diagnostics":
        return JSON.stringify(await this.getDiagnostics(args.file));
      case "refresh":
        return JSON.stringify(await this.refresh());
      default:
        throw new Error(`unknown code-intel operation: ${op}`);
    }
  }
  async collectDiagnostics(context, uri) {
    const cached = context.lsp.getDiagnostics(uri);
    if (cached.length > 0)
      return cached;
    const open = context.lsp.openDocuments.get(uri);
    if (!open) {
      const content = await readFile4(uriToPath(uri), "utf8").catch(() => null);
      if (content !== null) {
        const language = languageIdOf(uriToPath(uri));
        if (language)
          context.lsp.openTextDocument(uri, language, content);
      }
    } else {
      context.lsp.changeTextDocument(uri, open.text, open.version + 1);
    }
    return waitForDiagnostics(context.lsp, uri, 8000);
  }
}
function markRemote(prototype, method, exportName) {
  const context = {
    name: method,
    private: false,
    static: false,
    kind: "method",
    addInitializer: (init) => init.call(Object.create(prototype))
  };
  Remote(exportName ?? method)(undefined, context);
}
markRemote(CodeIntelService.prototype, "query");
function freshGraph(rootPath) {
  return { version: 1, rootPath, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), language: "typescript", files: {}, symbols: {}, errors: [] };
}
function safeParse(value) {
  try {
    return JSON.parse(value) ?? {};
  } catch {
    return {};
  }
}
function relativePathOf(context, uri) {
  const absolute = uriToPath(uri);
  return absolute.startsWith(context.root + "/") || absolute === context.root ? absolute.slice(context.root.length + 1) : absolute;
}
function containerNameAt(context, file, line) {
  if (!context.graph)
    return null;
  const symbols = context.graph.symbolsOfFile(file);
  let best = null;
  for (const symbol of symbols) {
    if (symbol.startLine - 1 <= line && line <= symbol.endLine - 1) {
      if (!best || symbol.startLine > best.startLine)
        best = symbol;
    }
  }
  return best?.namePath ?? null;
}
async function readLine(root, file, line) {
  const content = await readFile4(join4(root, file), "utf8").catch(() => null);
  if (content === null)
    return null;
  return content.split(`
`)[line - 1] ?? null;
}
async function readSymbolBody(root, file, startLine, endLine) {
  const content = await readFile4(join4(root, file), "utf8").catch(() => null);
  if (content === null)
    return null;
  const lines = content.split(`
`);
  return lines.slice(startLine - 1, endLine).join(`
`);
}
function waitForDiagnostics(client, uri, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(client.getDiagnostics(uri));
    }, timeoutMs);
    const listener = (event) => {
      if (event.uri === uri) {
        cleanup();
        resolve(event.diagnostics);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      client.off("diagnostics", listener);
    };
    client.on("diagnostics", listener);
  });
}

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-llm/lib/index.js
import { createRequire as createRequire2 } from "node:module";

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
var SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: `
`,
  r: "\r",
  t: "\t"
};
var CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
function isWhitespace(c) {
  return c === " " || c === `
` || c === "\r" || c === "\t";
}
function isHex(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
var PartialArguments = class PartialArguments {
  static EMPTY = PartialArguments.fromObject({});
  static fromText(text) {
    const view = new PartialArguments;
    view.append(text);
    view.sealed = true;
    return view;
  }
  static fromObject(value) {
    const view = new PartialArguments;
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    view.sealed = true;
    return view;
  }
  chunks = [];
  object;
  sealed = false;
  #ends = [];
  #size = 0;
  #consumed = 0;
  #mode = "root";
  #escape = false;
  #keyStart = 0;
  #keyEscaped = false;
  #key = "";
  #current = null;
  #nestedEnds = [];
  #nestedInString = false;
  #invalidAt;
  #invalidValue = false;
  #entries = /* @__PURE__ */ new Map;
  #order = [];
  #reads = /* @__PURE__ */ new Map;
  get isSealed() {
    return this.sealed;
  }
  get invalid() {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }
  append(fragment) {
    if (this.sealed)
      throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0)
      return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }
  settle(text) {
    if (this.object !== undefined || text.length !== this.#size)
      return PartialArguments.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset))
        return PartialArguments.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }
  refresh() {
    if (this.#reads.size === 0)
      return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values())
        if (read.completion)
          changed = this.refreshRead(read) || changed;
    }
    if (this.sealed)
      this.#reads.clear();
    return changed;
  }
  refreshRead(read) {
    const now = read.answer();
    if (Object.is(now, read.last))
      return false;
    read.last = now;
    return true;
  }
  closed() {
    return this.remember("closed", "", () => this.closedNow());
  }
  keys() {
    return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
  }
  has(key) {
    return this.remember("has", key, () => this.hasNow(key));
  }
  complete(key) {
    return this.remember("complete", key, () => this.completeNow(key));
  }
  stringLength(key, options) {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === undefined ? undefined : Math.ceil((length + offset) / step));
  }
  stringExceeds(key, maxLength) {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
  }
  text(key) {
    return this.remember("text", key, () => this.textNow(key));
  }
  textPrefix(key, maxLength) {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
  }
  value(key) {
    return this.remember("value", key, () => this.valueNow(key));
  }
  remember(kind, key, read, comparison) {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id = `${kind}/${key}`;
      if (!this.#reads.has(id))
        this.#reads.set(id, {
          completion: kind === "complete",
          answer: comparison === undefined ? read : () => comparison(read()),
          last: comparison === undefined ? result : comparison(result)
        });
    }
    return result;
  }
  closedNow() {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }
  keysNow() {
    return this.object === undefined ? this.#order : Object.keys(this.object);
  }
  hasNow(key) {
    return this.object === undefined ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }
  completeNow(key) {
    if (this.object !== undefined)
      return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== undefined && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === undefined : !entry.invalid);
  }
  lengthNow(key, limit = Number.POSITIVE_INFINITY) {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field.length : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string")
      return;
    if (entry.text !== undefined && entry.text.at === entry.end)
      return entry.text.length;
    const read = entry.length ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, limit, false);
    return read.length;
  }
  textNow(key) {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string")
      return;
    if (entry.text === undefined && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === undefined) {
      let text;
      try {
        text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
      } catch (_error) {}
      if (text !== undefined)
        entry.text = {
          at: entry.end,
          length: text.length,
          text
        };
    }
    const read = entry.text ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }
  textPrefixNow(key, maxLength) {
    if (this.object !== undefined) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : undefined;
      return typeof field === "string" ? field.slice(0, maxLength) : undefined;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string")
      return;
    const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map;
    let read = prefixes.get(maxLength);
    if (read === undefined) {
      read = {
        at: entry.start,
        length: 0,
        text: ""
      };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }
  valueNow(key) {
    if (this.object !== undefined) {
      if (!Object.hasOwn(this.object, key))
        return;
      const field = this.object[key];
      return typeof field === "string" ? undefined : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid)
      return;
    if (entry.parsed === undefined)
      try {
        entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
      } catch (_error) {
        entry.invalid = true;
        this.#invalidValue = true;
      }
    return entry.parsed;
  }
  chunkAt(at) {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.#ends[mid] <= at)
        low = mid + 1;
      else
        high = mid;
    }
    return low;
  }
  slice(start, end) {
    if (start >= end)
      return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : this.#ends[first - 1];
    if (first === last)
      return this.chunks[first].slice(start - base, end - base);
    const parts = [this.chunks[first].slice(start - base)];
    for (let i = first + 1;i < last; i++)
      parts.push(this.chunks[i]);
    parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
    return parts.join("");
  }
  readString(entry, read, limit, materialize) {
    const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0)
        return;
      if (materialize)
        read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
      const chunk = this.chunks[chunkIndex];
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize)
          read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length)
          chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : undefined;
      let decoded;
      let width = 2;
      if (remaining[0] === "\\" && type === undefined && entry.end < 0)
        return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0;i < hex.length; i++)
          if (!isHex(hex[i]))
            valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0)
            return;
          if (hex.length === 4)
            decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== undefined)
        decoded = SIMPLE_ESCAPES[type];
      if (decoded === undefined) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize)
        read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex])
        chunkIndex++;
    }
  }
  scan() {
    if (this.object !== undefined || this.#consumed === this.#size)
      return;
    for (let i = this.chunkAt(this.#consumed);i < this.chunks.length && this.#invalidAt === undefined; i++) {
      const pending = this.chunks[i];
      const base = i === 0 ? 0 : this.#ends[i - 1];
      for (let index = this.#consumed - base;index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length)
            break;
        }
        this.step(pending[index], this.#consumed);
        this.#consumed++;
      }
    }
  }
  stringBoundary(fragment, start) {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end)))
          entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\")
        slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped)
        return end;
      at = quote + 1;
    }
  }
  step(c, at) {
    switch (this.#mode) {
      case "root":
        if (isWhitespace(c))
          return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace(c))
          return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace(c))
          return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace(c))
          return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace(c))
          return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace(c))
          return;
        this.fail();
        return;
      case "invalid":
        return;
      default:
        assertNever(this.#mode);
    }
  }
  fail() {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }
  beginKey(at) {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }
  stepKey(c, at) {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"')
      return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped)
      try {
        this.#key = JSON.parse(`"${raw}"`);
      } catch (_error) {
        this.fail();
        return;
      }
    else
      this.#key = raw;
    this.#mode = "colon";
  }
  open(entry) {
    if (!this.#entries.has(this.#key))
      this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }
  beginValue(c, at) {
    if (isWhitespace(c))
      return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: undefined,
        length: undefined,
        text: undefined,
        prefixes: undefined
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({
      kind: "value",
      start: at,
      end: -1,
      parsed: undefined,
      invalid: false
    });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }
  stepScalar(c, at) {
    if (c !== "," && c !== "}" && !isWhitespace(c))
      return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }
  stepNested(c, at) {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }
  closeValue(end) {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
};
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
function hasIntrinsicConstructor(prototype, name) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function")
    return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(name === "Array" ? Array : Object);
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
function hasPlainArrayPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array"))
    return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
function hasPlainObjectPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
}
function enumerableStringKeys(value) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key)))
    return;
  return keys;
}
function walkJsonValue(value, detach) {
  const ancestors = /* @__PURE__ */ new Set;
  let root;
  let parent;
  const assign = (item) => {
    if (parent === undefined) {
      if (detach)
        root = item;
    } else if (parent.kind === "array") {
      if (parent.target !== undefined)
        parent.target[parent.key] = item;
    } else if (parent.target !== undefined)
      Object.defineProperty(parent.target, parent.key, {
        value: item,
        enumerable: true,
        configurable: true,
        writable: true
      });
  };
  const frames = [];
  let current = value;
  for (;; ) {
    if (current === null)
      assign(null);
    else if (typeof current === "boolean" || typeof current === "string")
      assign(current);
    else if (typeof current === "number") {
      if (!Number.isFinite(current) || Object.is(current, -0))
        return;
      assign(current);
    } else {
      if (typeof current !== "object")
        return;
      if (ancestors.has(current))
        return;
      if (Array.isArray(current)) {
        if (!hasPlainArrayPrototype(current))
          return;
        const length = current.length;
        if (Reflect.ownKeys(current).length !== length + 1)
          return;
        const target = detach ? [] : undefined;
        if (target !== undefined)
          assign(target);
        let indices;
        if (!Number.isInteger(length)) {
          indices = [];
          for (let index = length - 1;index >= 0; index--)
            indices.push(index);
        }
        frames.push({
          kind: "array",
          source: current,
          length: indices?.length ?? length,
          index: 0,
          key: 0,
          indices,
          target
        });
      } else {
        if (!hasPlainObjectPrototype(current))
          return;
        const keys = enumerableStringKeys(current);
        if (keys === undefined)
          return;
        const target = detach ? {} : undefined;
        if (target !== undefined)
          assign(target);
        frames.push({
          kind: "object",
          source: current,
          keys,
          index: 0,
          key: "",
          target
        });
      }
      ancestors.add(current);
    }
    for (;; ) {
      const frame = frames.at(-1);
      if (frame === undefined)
        return detach ? root : true;
      const length = frame.kind === "array" ? frame.length : frame.keys.length;
      if (frame.index >= length) {
        ancestors.delete(frame.source);
        frames.pop();
        continue;
      }
      const index = frame.index++;
      parent = frame;
      if (frame.kind === "array") {
        const key = frame.indices === undefined ? index : frame.indices[frame.indices.length - index - 1];
        if (key === undefined)
          return;
        if (!Object.prototype.hasOwnProperty.call(frame.source, key))
          return;
        frame.key = key;
        current = frame.source[key];
      } else {
        const key = frame.keys[index];
        if (key === undefined)
          return;
        frame.key = key;
        current = frame.source[key];
      }
      break;
    }
  }
}
function snapshotJsonValue(value) {
  return walkJsonValue(value, true);
}
function isJsonValue(value) {
  return walkJsonValue(value, false) === true;
}
function deepFreeze(value) {
  const seen = /* @__PURE__ */ new WeakSet;
  const pending = [{
    kind: "visit",
    node: value
  }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === undefined)
      continue;
    if (task.kind === "property") {
      pending.push({
        kind: "visit",
        node: task.source[task.key]
      });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object")
      continue;
    if (node instanceof AbortSignal)
      continue;
    if (seen.has(node))
      continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let index = keys.length - 1;index >= 0; index--) {
      const key = keys[index];
      if (key === undefined)
        continue;
      pending.push({
        kind: "property",
        source: node,
        key
      });
    }
  }
  return value;
}

// ../../.bun/install/global/node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError2 = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = undefined;
var ValidationError2 = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || [])
      if (typeof segment === "string")
        prefix += "." + segment;
      else if (typeof segment === "number")
        prefix += "[" + segment + "]";
      else if (typeof segment === "symbol")
        prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith("."))
      prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError2];
  }
};
Object.defineProperty(ValidationError2.prototype, kValidationError2, { value: true });
var Schema = function(options) {
  const schema = function(data, options = {}) {
    return Schema.resolve(data, schema, options)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options) => new Schema(options));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options = refs[key];
      options.sKey = getRef(options.sKey);
      options.inner = getRef(options.inner);
      options.list = options.list && options.list.map(getRef);
      options.dict = options.dict && mapValues(options.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string")
    try {
      schema.callback = new Function("return " + schema.callback)();
    } catch {}
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError2.is(error))
          return { issues: [{
            message: error.message,
            path: error.options.path
          }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError2;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = undefined;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc)
      result[locale] = value.$description || value.$desc;
    else if (typeof value === "string")
      result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length)
    schema.meta.description = desc;
  if (schema.dict)
    schema.dict = mapValues(schema.dict, (inner, key) => {
      return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
    });
  if (schema.list)
    schema.list = schema.list.map((inner, index) => {
      return inner.i18n(mapValues(messages, (data = {}) => {
        if (Array.isArray(getInner(data)))
          return getInner(data)[index];
        if (Array.isArray(data))
          return data[index];
        return extractKeys(data);
      }));
    });
  if (schema.inner)
    schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
      if (getInner(data))
        return getInner(data);
      return extractKeys(data);
    }));
  if (schema.sKey)
    schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
])
  Object.assign(Schema.prototype, { [key](value = true) {
    const schema = Schema(this);
    schema.meta = {
      ...schema.meta,
      [key]: value
    };
    return schema;
  } });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (isVolatile(value))
    value = value.get();
  if (deepEqual(value, this.meta.default, this.type === "dict"))
    return null;
  if (isNullable(value))
    return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item))
        result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict"))
      return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value) : value;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list)
      Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union")
    for (const schema of this.list)
      try {
        Schema.resolve(value, schema, {});
        return schema.simplify(value);
      } catch {}
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
])
  Object.assign(Schema.prototype, { [key](value) {
    const schema = Schema(this);
    schema.meta = {
      ...schema.meta,
      [key]: value
    };
    return schema;
  } });
Schema.prototype.volatile = function volatile() {
  if (this.meta.volatile)
    throw new TypeError("volatile schema is already wrapped");
  return this.extra("volatile", true);
};
var resolvers = {};
var checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set;
  if (states.has(blocked))
    return;
  states.add(blocked);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked)
    throw new ValidationError2("volatile fields require a fixed object path without an enclosing volatile field", { path });
  const nested = blocked || !!schema.meta?.volatile;
  if (schema.dict)
    for (const [key, child] of Object.entries(schema.dict))
      validateVolatileSchema(child, [...path, key], nested, seen);
  if (schema.sKey)
    validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema]))
    validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
  if (schema.list)
    for (let index = 0;index < schema.list.length; index++)
      validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve) {
  resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema)
    return [data];
  if (!options[checkedVolatile]) {
    validateVolatileSchema(schema, options.path);
    options = {
      ...options,
      [checkedVolatile]: true
    };
  }
  if (schema.meta?.volatile) {
    const inner = Schema(schema);
    inner.meta = {
      ...schema.meta,
      volatile: false
    };
    const [value, adapted] = Schema.resolve(data, inner, options, strict);
    try {
      return [createVolatile(value), adapted];
    } catch (error) {
      throw new ValidationError2(error instanceof Error ? error.message : String(error), options);
    }
  }
  if (options.ignore?.(data, schema))
    return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required)
      throw new ValidationError2(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback))
      return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback)
    throw new ValidationError2(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose)
      throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source))
    return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source))
    return Schema.const(source).required();
  else if (source[kSchema])
    return source;
  else if (typeof source === "function")
    switch (source) {
      case String:
        return Schema.string().required();
      case Number:
        return Schema.number().required();
      case Boolean:
        return Schema.boolean().required();
      case Function:
        return Schema.function().required();
      default:
        return Schema.is(source).required();
    }
  else
    throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date = new Date(value);
    if (isNaN(+date))
      throw new ValidationError2(`invalid date "${value}"`, options);
    return date;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError2(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value))
        return Binary.fromSource(value);
      throw new ValidationError2(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError2(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
    validateVolatileSchema(schema.inner, options.path, true);
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError2(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value))
    return [value];
  throw new ValidationError2(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max)
    throw new ValidationError2(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin)
    throw new ValidationError2(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string")
    throw new ValidationError2(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data))
      throw new ValidationError2(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e"))
    return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1)
    return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits)
    return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString()))
    return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number")
    throw new ValidationError2(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step))
    throw new ValidationError2(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean")
    return [data];
  throw new ValidationError2(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits)
      if (data & bits[key])
        keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string")
        throw new ValidationError2(`expected string but got ${key}`, options);
      if (key in bits)
        value |= bits[key];
    }
  } else
    throw new ValidationError2(`expected number or array but got ${data}`, options);
  if (value === meta.default)
    return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function")
    return [data];
  throw new ValidationError2(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor)
      return [data];
    throw new ValidationError2(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data))
      throw new ValidationError2(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor)
        return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError2(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== undefined)
      data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix)
      throw e;
    delete data[key];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data))
    throw new ValidationError2(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data))
    throw new ValidationError2(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict)
        continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey)
      delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data))
    throw new ValidationError2(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict)
    return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result)
      continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data))
    throw new ValidationError2(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data)
      result[key] = value;
  }
  if (!strict)
    merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
  const messages = [];
  for (const inner of list)
    try {
      return Schema.resolve(data, inner, options, strict);
    } catch (error) {
      messages.push(error);
    }
  throw new ValidationError2(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
  if (!list.length)
    return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value))
      continue;
    if (isNullable(result))
      result = value;
    else if (typeof result !== typeof value)
      throw new ValidationError2(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object")
      merge(result ??= {}, value);
    else if (result !== value)
      throw new ValidationError2(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data))
    merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve)
    return [callback(result)];
  else
    return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name, keys, format) {
  formatters[name] = format;
  Object.assign(Schema, { [name](...args) {
    const schema = new Schema({ type: name });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key in args[index]) {
            if (typeof args[index][key] !== "number")
              continue;
            schema.bits[key] = args[index][key];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function")
            constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name === "object" || name === "dict")
      schema.meta.default = {};
    else if (name === "array" || name === "tuple")
      schema.meta.default = [];
    else if (name === "bitset")
      schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function")
    return constructor.name;
  else
    return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0)
    return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-timeout/lib/index.js
var MAX_TIMER_DELAY_MS = 2147483647;

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-llm/lib/index.js
function freezeMessage(message) {
  return deepFreeze(structuredClone(message));
}
var HarnessError = class extends Error {
  code;
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
    this.name = new.target.name;
  }
};
var EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
var STRUCTURED_CONTEXT_OVERFLOW = new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
var TOO_LARGE_FOR_CONTEXT = new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
var EXCEEDS_MODEL_CONTEXT = new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
var DEFAULT_MAX_RETRIES = 5;
var DEFAULT_INITIAL_DELAY_MS = 500;
var DEFAULT_MAX_DELAY_MS = 1e4;
var DEFAULT_JITTER_RATIO = 0.1;
var DEFAULT_RETRYABLE_CODES = Object.freeze([
  EMPTY_RESPONSE_CODE,
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT"
]);
var backoffSchema = Schema.object({
  initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
  maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
  jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
var normalPolicySchema = Schema.object({
  mode: Schema.const("normal").required(),
  maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
  retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
  backoff: backoffSchema
});
var alwaysPolicySchema = Schema.object({
  mode: Schema.const("always").required(),
  backoff: backoffSchema
});
var RetryPolicySchema = Schema.union([normalPolicySchema, alwaysPolicySchema]);
var NORMAL_POLICY_KEYS = new Set([
  "mode",
  "maxRetries",
  "retryableCodes",
  "backoff"
]);
var ALWAYS_POLICY_KEYS = new Set([
  "mode",
  "maxRetries",
  "retryableCodes",
  "backoff"
]);
var BACKOFF_KEYS = new Set([
  "initialDelayMs",
  "maxDelayMs",
  "jitterRatio"
]);
function validateKeys(value, allowed, path) {
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`${path}: unknown key "${key}"`);
}
function resolveBackoff(config, path) {
  if (config !== undefined)
    validateKeys(config, BACKOFF_KEYS, path);
  const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
  if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > MAX_TIMER_DELAY_MS)
    throw new Error(`${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
  if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > MAX_TIMER_DELAY_MS)
    throw new Error(`${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
  if (initialDelayMs > maxDelayMs)
    throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1)
    throw new Error(`${path}.jitterRatio must be between 0 and 1`);
  return Object.freeze({
    initialDelayMs,
    maxDelayMs,
    jitterRatio
  });
}
function resolveRetryPolicy(config, path) {
  if (config === undefined)
    return Object.freeze({
      mode: "normal",
      maxRetries: DEFAULT_MAX_RETRIES,
      retryableCodes: DEFAULT_RETRYABLE_CODES,
      ...resolveBackoff(undefined, `${path}.backoff`)
    });
  switch (config.mode) {
    case "normal": {
      validateKeys(config, NORMAL_POLICY_KEYS, path);
      const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
      const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
      if (!Number.isSafeInteger(maxRetries) || maxRetries < 0)
        throw new Error(`${path}.maxRetries must be a non-negative safe integer`);
      if (retryableCodes.length === 0)
        throw new Error(`${path}.retryableCodes must not be empty`);
      if (retryableCodes.some((code) => typeof code !== "string" || code.length === 0))
        throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
      if (new Set(retryableCodes).size !== retryableCodes.length)
        throw new Error(`${path}.retryableCodes must not contain duplicates`);
      return Object.freeze({
        mode: "normal",
        maxRetries,
        retryableCodes: Object.freeze([...retryableCodes]),
        ...resolveBackoff(config.backoff, `${path}.backoff`)
      });
    }
    case "always":
      validateKeys(config, ALWAYS_POLICY_KEYS, path);
      return Object.freeze({
        mode: "always",
        ...resolveBackoff(config.backoff, `${path}.backoff`)
      });
    default:
      throw new Error(`${path}.mode must be "normal" or "always"`);
  }
}
function callConfigEquals(a, b) {
  if (a.provider !== b.provider || a.model !== b.model || a.reasoningEffort !== b.reasoningEffort || a.temperature !== b.temperature || a.maxTokens !== b.maxTokens)
    return false;
  if (a.stop === undefined || b.stop === undefined)
    return a.stop === b.stop;
  return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i]);
}
function normalizeLlmFailure(value) {
  const error = value instanceof Error ? value : new HarnessError(thrownMessage(value), "UNKNOWN", { cause: value });
  const carried = ownFailureSnapshot(error);
  if (carried !== undefined && carried.code === ownErrorCode(error))
    return carried;
  return Object.freeze({
    message: errorMessage(error),
    code: harnessErrorCode(error)
  });
}
function thrownMessage(value) {
  try {
    const message = String(value);
    return message.length > 0 ? message : "LLM adapter failed";
  } catch (_hostileThrownValue) {
    return "LLM adapter failed";
  }
}
function ownErrorCode(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  } catch (_sdkPropertyTrap) {
    return;
  }
}
function ownFailureSnapshot(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "failure");
    return descriptor !== undefined && "value" in descriptor ? failureSnapshot(descriptor.value) : undefined;
  } catch (_sdkPropertyTrap) {
    return;
  }
}
function failureSnapshot(value) {
  if (typeof value !== "object" || value === null)
    return;
  try {
    const candidate = value;
    const message = candidate.message;
    const code = candidate.code;
    const status = candidate.status;
    const providerRetryAfterMs = candidate.providerRetryAfterMs;
    const requestId = candidate.requestId;
    const offloadImages = candidate.offloadImages;
    if (typeof message !== "string" || message.length === 0 || typeof code !== "string" || code.length === 0 || status !== undefined && (!Number.isInteger(status) || status < 100 || status > 599) || providerRetryAfterMs !== undefined && (!Number.isFinite(providerRetryAfterMs) || providerRetryAfterMs <= 0) || requestId !== undefined && (typeof requestId !== "string" || requestId.length === 0) || offloadImages !== undefined && (!Number.isSafeInteger(offloadImages) || offloadImages <= 0))
      return;
    return Object.freeze({
      message,
      code,
      ...status === undefined ? {} : { status },
      ...providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs },
      ...requestId === undefined ? {} : { requestId },
      ...offloadImages === undefined ? {} : { offloadImages }
    });
  } catch (_sdkFailureGetter) {
    return;
  }
}
function errorMessage(error) {
  try {
    const message = error.message;
    if (typeof message === "string" && message.length > 0)
      return message;
  } catch (_sdkMessageGetter) {}
  return "LLM adapter failed";
}
function harnessErrorCode(error) {
  return error instanceof HarnessError ? error.code : "UNKNOWN";
}
function quoted(value) {
  return JSON.stringify(value);
}
function textOnlyImageText(ref) {
  return `[image omitted because this model accepts text only; attachment sha256:${String(ref.attachmentId).slice(7, 15)}]`;
}
function contentHasImage(content) {
  return content.some((block) => block.type === "image");
}
function contentHasFile(content) {
  for (const block of content)
    if (block.type === "file")
      return true;
  return false;
}
function fileHandleText(ref, readonlyPath) {
  const digest = String(ref.attachmentId).slice(7, 15);
  const identity = `File ${quoted(ref.name)} (${ref.bytes} bytes, sha256:${digest})`;
  if (readonlyPath === undefined)
    return `[${identity} was uploaded, but the current execution environment cannot access a readable path. Report that limitation if its contents are needed; do not claim to have read it.]`;
  return `[${identity}: verbatim read-only copy saved at ${quoted(readonlyPath)}. Read that path with your file tools when its contents are needed; copy it to a writable location before modifying it. When delegating file work, include this saved path in the delegation prompt; only subagents sharing this execution environment can read it.]`;
}
function replaceFilesWithHandles(blocks, resolvePath) {
  let next;
  for (const [index, block] of blocks.entries()) {
    if (block.type === "file") {
      next ??= blocks.slice(0, index);
      next.push({
        type: "text",
        text: fileHandleText(block.attachment, resolvePath(block.attachment))
      });
      continue;
    }
    next?.push(block);
  }
  return next ?? blocks;
}
function projectFilesToText(messages, resolvePath) {
  if (!messages.some((message) => contentHasFile(message.content)))
    return messages;
  return messages.map((message) => {
    const content = replaceFilesWithHandles(message.content, resolvePath);
    return content === message.content ? message : {
      ...message,
      content
    };
  });
}
function replaceImagesForTextModel(blocks) {
  let next;
  for (const [index, block] of blocks.entries()) {
    if (block.type === "image") {
      next ??= blocks.slice(0, index);
      next.push({
        type: "text",
        text: textOnlyImageText(block.attachment)
      });
      continue;
    }
    next?.push(block);
  }
  return next ?? blocks;
}
function projectImagesForTextModel(messages) {
  if (!messages.some((message) => contentHasImage(message.content)))
    return messages;
  return messages.map((message) => {
    const content = replaceImagesForTextModel(message.content);
    return content === message.content ? message : {
      ...message,
      content
    };
  });
}
function withoutDeveloperMessages(messages) {
  const retained = messages.filter((message) => message.role !== "developer");
  return retained.length === messages.length ? messages : retained;
}
function toolDeclarations(tools, mode, history) {
  const declarations = new Map(history.tools.map((tool) => [tool.name, tool]));
  for (const update of history.updates)
    for (const tool of update.additions)
      if (!declarations.has(tool.name))
        declarations.set(tool.name, {
          ...tool,
          deferLoading: true
        });
  switch (mode) {
    case "in-history":
      return declarations;
    case "addition-only": {
      const activeNames = new Set(tools?.map((tool) => tool.name));
      for (const name of declarations.keys())
        if (!activeNames.has(name))
          declarations.delete(name);
      return declarations;
    }
    default:
      return assertNever(mode);
  }
}
function projectToolUpdates(messages, tools, toolUpdate, history) {
  if (toolUpdate === undefined) {
    let immediateTools = tools;
    if (tools?.some((tool) => tool.deferLoading === true))
      immediateTools = tools.map(({ deferLoading: _loading, ...tool }) => tool);
    return {
      messages: withoutDeveloperMessages(messages),
      tools: immediateTools
    };
  }
  if (history === undefined)
    return {
      messages: withoutDeveloperMessages(messages),
      tools
    };
  const messageIds = new Set(messages.flatMap((message) => message.role === "developer" ? [message.id] : []));
  if (history.updates.some((update) => !messageIds.has(update.messageId)))
    return {
      messages: withoutDeveloperMessages(messages),
      tools
    };
  const declarations = toolDeclarations(tools, toolUpdate, history);
  const updateIds = new Set(history.updates.map((update) => update.messageId));
  const offered = new Set(history.tools.filter((tool) => !tool.deferLoading).map((tool) => tool.name));
  const projectedMessages = [];
  for (const message of messages) {
    if (message.role !== "developer") {
      projectedMessages.push(message);
      continue;
    }
    if (!updateIds.has(message.id))
      continue;
    const content = message.content.filter((block) => {
      switch (block.type) {
        case "tool-addition":
          if (!declarations.has(block.toolName) || offered.has(block.toolName))
            return false;
          offered.add(block.toolName);
          return true;
        case "tool-removal":
          if (toolUpdate !== "in-history")
            return false;
          return offered.delete(block.toolName);
        default:
          return true;
      }
    });
    if (content.length === 0)
      continue;
    if (content.length === message.content.length)
      projectedMessages.push(message);
    else
      projectedMessages.push({
        ...message,
        content
      });
  }
  return {
    messages: projectedMessages.length === messages.length && projectedMessages.every((message, index) => message === messages[index]) ? messages : projectedMessages,
    tools: [...declarations.values()]
  };
}
var { version } = createRequire2(import.meta.url)("../package.json");
var __runInitializers = function(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0;i < initializers.length; i++)
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  return useValue ? value : undefined;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== undefined && typeof f !== "function")
      throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1;i >= 0; i--) {
    var context = {};
    for (var p in contextIn)
      context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access)
      context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done)
        throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? {
      get: descriptor.get,
      set: descriptor.set
    } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === undefined)
        continue;
      if (result === null || typeof result !== "object")
        throw new TypeError("Object expected");
      if (_ = accept(result.get))
        descriptor.get = _;
      if (_ = accept(result.set))
        descriptor.set = _;
      if (_ = accept(result.init))
        initializers.unshift(_);
    } else if (_ = accept(result))
      if (kind === "field")
        initializers.unshift(_);
      else
        descriptor[key] = _;
  }
  if (target)
    Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
};
var LlmError = class extends HarnessError {
  failure;
  constructor(message, code, options) {
    if (typeof message !== "string" || message.length === 0)
      throw new Error("LlmError message must be a non-empty string");
    if (typeof code !== "string" || code.length === 0)
      throw new Error("LlmError code must be a non-empty string");
    if (options?.status !== undefined && (!Number.isInteger(options.status) || options.status < 100 || options.status > 599))
      throw new Error("LlmError status must be an integer from 100 through 599");
    if (options?.providerRetryAfterMs !== undefined && (!Number.isFinite(options.providerRetryAfterMs) || options.providerRetryAfterMs <= 0))
      throw new Error("LlmError providerRetryAfterMs must be a positive finite number");
    if (options?.requestId !== undefined && (typeof options.requestId !== "string" || options.requestId.length === 0))
      throw new Error("LlmError requestId must be a non-empty string");
    super(message, code, options);
    this.name = "LlmError";
    this.failure = Object.freeze({
      message,
      code,
      ...options?.status === undefined ? {} : { status: options.status },
      ...options?.providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs: options.providerRetryAfterMs },
      ...options?.requestId === undefined ? {} : { requestId: options.requestId },
      ...options?.offloadImages === undefined ? {} : { offloadImages: options.offloadImages }
    });
  }
};
var LlmRuntime = (() => {
  let _classSuper = TypertRemoteService;
  let _instanceExtraInitializers = [];
  let _listProviders_decorators;
  let _listConfigurableProviders_decorators;
  let _remoteDiscoverModels_decorators;
  return class LlmRuntime extends _classSuper {
    static {
      const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : undefined;
      _listProviders_decorators = [Remote];
      _listConfigurableProviders_decorators = [Remote];
      _remoteDiscoverModels_decorators = [Remote("discoverModels")];
      __esDecorate(this, null, _listProviders_decorators, {
        kind: "method",
        name: "listProviders",
        static: false,
        private: false,
        access: {
          has: (obj) => ("listProviders" in obj),
          get: (obj) => obj.listProviders
        },
        metadata: _metadata
      }, null, _instanceExtraInitializers);
      __esDecorate(this, null, _listConfigurableProviders_decorators, {
        kind: "method",
        name: "listConfigurableProviders",
        static: false,
        private: false,
        access: {
          has: (obj) => ("listConfigurableProviders" in obj),
          get: (obj) => obj.listConfigurableProviders
        },
        metadata: _metadata
      }, null, _instanceExtraInitializers);
      __esDecorate(this, null, _remoteDiscoverModels_decorators, {
        kind: "method",
        name: "remoteDiscoverModels",
        static: false,
        private: false,
        access: {
          has: (obj) => ("remoteDiscoverModels" in obj),
          get: (obj) => obj.remoteDiscoverModels
        },
        metadata: _metadata
      }, null, _instanceExtraInitializers);
      if (_metadata)
        Object.defineProperty(this, Symbol.metadata, {
          enumerable: true,
          configurable: true,
          writable: true,
          value: _metadata
        });
    }
    adapters = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map);
    directory = /* @__PURE__ */ new Map;
    discoveries = /* @__PURE__ */ new Map;
    constructor(ctx) {
      super(ctx, "llm");
    }
    emitAdaptersUpdated() {
      for (const listener of this.ctx.events.dispatch("emit", ["llm/adapters-updated"]))
        try {
          const returned = listener();
          if (returned != null && typeof returned.then === "function")
            Promise.resolve(returned).then(undefined, (error) => {
              this.warnAdaptersListenerFailure(error);
            });
        } catch (error) {
          this.warnAdaptersListenerFailure(error);
        }
    }
    warnAdaptersListenerFailure(error) {
      this.ctx.logger.warn("llm: an llm/adapters-updated listener failed");
      this.ctx.logger.warn(error);
    }
    registerAdapter(providers, adapter) {
      const owned = /* @__PURE__ */ new Set;
      let released = false;
      const dispose = this.ctx.effect(function* () {
        if (providers.length === 0)
          throw new LlmError("an adapter must register at least one provider", "INVALID_ADAPTER");
        this.commitRoutes(owned, this.prepareRoutes(providers, adapter, owned));
        yield () => {
          released = true;
          for (const provider of owned)
            this.adapters.delete(provider);
          owned.clear();
          this.emitAdaptersUpdated();
        };
      }.bind(this), "llm.registerAdapter()");
      const handle = () => void dispose();
      handle.replace = (next) => {
        if (released)
          throw new LlmError("a disposed adapter registration cannot replace its routes", "REGISTRATION_DISPOSED");
        this.commitRoutes(owned, this.prepareRoutes(next, adapter, owned));
      };
      return handle;
    }
    prepareRoutes(providers, adapter, owned) {
      const unique = /* @__PURE__ */ new Set;
      const registrations = [];
      for (const provider of providers) {
        if (provider.length === 0)
          throw new LlmError("adapter provider names must be non-empty", "INVALID_ADAPTER");
        if (unique.has(provider) || this.adapters.has(provider) && !owned.has(provider))
          throw new LlmError(`an adapter for provider "${provider}" is already registered`, "DUPLICATE_ADAPTER");
        const info = adapter.providerInfo(provider);
        if (typeof info.id !== "string" || info.id !== provider || typeof info.name !== "string" || info.name.length === 0)
          throw new LlmError(`adapter metadata for provider "${provider}" must preserve its id and have a non-empty name`, "INVALID_ADAPTER");
        unique.add(provider);
        const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(undefined, `llm: provider "${provider}" retryPolicy`);
        registrations.push({
          adapter,
          provider: {
            id: info.id,
            name: info.name
          },
          retryPolicy
        });
      }
      return registrations;
    }
    commitRoutes(owned, registrations) {
      for (const provider of owned)
        this.adapters.delete(provider);
      owned.clear();
      for (const registration of registrations) {
        this.adapters.set(registration.provider.id, registration);
        owned.add(registration.provider.id);
      }
      this.emitAdaptersUpdated();
    }
    listProviders() {
      return [...this.adapters.values()].map(({ provider }) => ({ ...provider }));
    }
    registerConfigurableProviders(entries) {
      let held = [];
      let disposed = false;
      const commit = (candidates) => {
        const detached = [];
        const own = new Set(held.map((entry) => entry.provider));
        for (const entry of candidates) {
          if (entry.provider.length === 0 || entry.displayName.length === 0 || entry.settingsNs.length === 0)
            throw new LlmError("configurable providers need a non-empty provider, displayName, and settingsNs", "INVALID_DIRECTORY");
          if (entry.settingsPath.some((segment) => segment.length === 0))
            throw new LlmError(`configurable provider "${entry.provider}" has an empty settingsPath segment`, "INVALID_DIRECTORY");
          if (this.directory.has(entry.provider) && !own.has(entry.provider) || detached.some((seen) => seen.provider === entry.provider))
            throw new LlmError(`configurable provider "${entry.provider}" is already declared`, "DUPLICATE_DIRECTORY");
          detached.push(detachDirectoryEntry(entry));
        }
        for (const entry of held)
          this.directory.delete(entry.provider);
        for (const entry of detached)
          this.directory.set(entry.provider, entry);
        held = detached;
        this.emitAdaptersUpdated();
      };
      const dispose = this.ctx.effect(function* () {
        if (entries.length === 0)
          throw new LlmError("a configurable-provider registration must declare at least one provider", "INVALID_DIRECTORY");
        commit(entries);
        yield () => {
          disposed = true;
          for (const entry of held)
            this.directory.delete(entry.provider);
          held = [];
          this.emitAdaptersUpdated();
        };
      }.bind(this), "llm.registerConfigurableProviders()");
      const handle = () => void dispose();
      handle.replace = (next) => {
        if (disposed)
          throw new LlmError("this configurable-provider registration was disposed", "REGISTRATION_DISPOSED");
        commit(next);
      };
      return handle;
    }
    listConfigurableProviders() {
      return [...this.directory.values()].map(detachDirectoryEntry);
    }
    registerModelDiscovery(settingsNs, discover) {
      const dispose = this.ctx.effect(function* () {
        if (settingsNs.length === 0)
          throw new LlmError("model discovery needs a non-empty settings namespace", "INVALID_DISCOVERY");
        if (this.discoveries.has(settingsNs))
          throw new LlmError(`model discovery for "${settingsNs}" is already registered`, "DUPLICATE_DISCOVERY");
        this.discoveries.set(settingsNs, discover);
        yield () => {
          this.discoveries.delete(settingsNs);
        };
      }.bind(this), "llm.registerModelDiscovery()");
      return () => void dispose();
    }
    async discoverModels(settingsNs, request, signal) {
      const discover = this.discoveries.get(settingsNs);
      if (discover === undefined)
        throw new LlmError(`no model discovery is registered for "${settingsNs}"`, "NO_DISCOVERY");
      if ((request.provider ?? "").length === 0 && (request.baseURL ?? "").length === 0)
        throw new LlmError("model discovery needs a provider route or a baseURL", "INVALID_DISCOVERY");
      const discovered = signal === undefined ? await discover(request) : await discover(request, signal);
      const seen = /* @__PURE__ */ new Set;
      const models = [];
      for (const model of discovered) {
        if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id))
          continue;
        seen.add(model.id);
        models.push({
          id: model.id,
          ...model.name === undefined ? {} : { name: model.name },
          ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
          ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
          ...model.inputModalities === undefined ? {} : { inputModalities: [...model.inputModalities] }
        });
      }
      return models;
    }
    async remoteDiscoverModels(settingsNs, request, signal) {
      try {
        return await this.discoverModels(settingsNs, request, signal);
      } catch (error) {
        throw new RemoteError("llm/model-discovery-rejected", error instanceof Error ? error.message : String(error), {
          settingsNs,
          ...request.baseURL === undefined ? {} : { baseURL: request.baseURL }
        }, { cause: error });
      }
    }
    providerRetryPolicy(provider) {
      return this.registration(provider).retryPolicy;
    }
    imageRequestPricing(provider, model) {
      return this.adapters.get(provider)?.adapter.imageRequestPricing(provider, model);
    }
    imageRequestTarget(provider, model, image) {
      return this.registration(provider).adapter.imageRequestTarget(provider, model, image);
    }
    fileRequestText(ref) {
      return fileHandleText(ref, this.fileReadPath(ref));
    }
    detachedModalities(modalities) {
      return modalities === undefined ? undefined : [...modalities];
    }
    async listModels(provider) {
      const models = await this.registration(provider).adapter.listModels(provider);
      const seen = /* @__PURE__ */ new Set;
      return models.map((model) => {
        if (typeof model.provider !== "string" || model.provider !== provider || typeof model.id !== "string" || model.id.length === 0 || typeof model.name !== "string" || model.name.length === 0 || model.description !== undefined && typeof model.description !== "string" || seen.has(model.id))
          throw new LlmError(`adapter returned invalid or duplicate model metadata for provider "${provider}"`, "INVALID_CATALOG");
        seen.add(model.id);
        const inputModalities = this.detachedModalities(model.inputModalities);
        const badge = model.badge;
        return {
          provider: model.provider,
          id: model.id,
          name: model.name,
          ...model.description === undefined ? {} : { description: model.description },
          ...inputModalities === undefined ? {} : { inputModalities },
          ...badge === undefined ? {} : { badge: {
            text: typeof badge.text === "string" ? badge.text : { ...badge.text },
            tone: badge.tone
          } }
        };
      });
    }
    async resolveModelInfo(provider, model, signal) {
      return this.resolveModelInfoFor(this.registration(provider), model, signal);
    }
    async resolveModelInfoFor(registration, model, signal) {
      const resolved = await registration.adapter.resolveModel(registration.provider.id, model, signal);
      return this.normalizeModelInfo(registration, model, resolved);
    }
    normalizeModelInfo(registration, model, resolved) {
      const provider = registration.provider.id;
      if (typeof resolved.provider !== "string" || resolved.provider !== provider || typeof resolved.id !== "string" || resolved.id !== model || typeof resolved.name !== "string" || resolved.name.length === 0 || resolved.description !== undefined && typeof resolved.description !== "string")
        throw new LlmError(`adapter returned invalid exact model metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
      const context = resolved.context;
      if (context !== undefined && (!Number.isInteger(context.contextWindow) || context.contextWindow <= 0))
        throw new LlmError(`adapter returned invalid context metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_CONTEXT");
      const inputModalities = this.detachedModalities(resolved.inputModalities);
      const systemPromptUpdate = resolved.systemPromptUpdate;
      if (systemPromptUpdate !== undefined && systemPromptUpdate !== "in-history")
        throw new LlmError(`adapter returned invalid system prompt update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
      const toolUpdate = resolved.toolUpdate;
      if (toolUpdate !== undefined && toolUpdate !== "in-history" && toolUpdate !== "addition-only")
        throw new LlmError(`adapter returned invalid tool update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
      const defaultMaxTokens = resolved.defaultMaxTokens;
      if (defaultMaxTokens !== undefined && (!Number.isSafeInteger(defaultMaxTokens) || defaultMaxTokens <= 0))
        throw new LlmError(`adapter returned invalid default maxTokens for provider "${provider}" model "${model}"`, "INVALID_MODEL_MAX_TOKENS");
      const info = {
        provider,
        id: model,
        name: resolved.name,
        ...resolved.description === undefined ? {} : { description: resolved.description },
        ...inputModalities === undefined ? {} : { inputModalities },
        ...context === undefined ? {} : { context: { contextWindow: context.contextWindow } },
        ...defaultMaxTokens === undefined ? {} : { defaultMaxTokens },
        ...resolved.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: resolved.systemPromptUpdate },
        ...resolved.toolUpdate === undefined ? {} : { toolUpdate: resolved.toolUpdate }
      };
      const reasoning = resolved.reasoning;
      if (reasoning === undefined)
        return info;
      if (reasoning.efforts.length === 0)
        throw new LlmError(`adapter returned invalid reasoning metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
      const seen = /* @__PURE__ */ new Set;
      const efforts = reasoning.efforts.map((effort) => {
        if (typeof effort.id !== "string" || effort.id.length === 0 || typeof effort.name !== "string" || effort.name.length === 0 || effort.description !== undefined && typeof effort.description !== "string" || seen.has(effort.id))
          throw new LlmError(`adapter returned invalid or duplicate reasoning effort metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
        seen.add(effort.id);
        return {
          id: effort.id,
          name: effort.name,
          ...effort.description === undefined ? {} : { description: effort.description }
        };
      });
      if (reasoning.defaultEffort !== undefined && !seen.has(reasoning.defaultEffort))
        throw new LlmError(`adapter returned an unknown default reasoning effort for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
      return {
        ...info,
        reasoning: {
          efforts,
          ...reasoning.defaultEffort === undefined ? {} : { defaultEffort: reasoning.defaultEffort }
        }
      };
    }
    async resolveCallConfig(config, signal) {
      return (await this.resolveCallFor(this.registration(config.provider), config, signal)).config;
    }
    async resolveCallFor(registration, config, signal) {
      const info = await this.resolveModelInfoFor(registration, config.model, signal);
      return this.resolveCallWithInfo(config, info);
    }
    resolveCallWithInfo(config, info) {
      const defaulted = config.maxTokens === undefined && info.defaultMaxTokens !== undefined ? {
        ...config,
        maxTokens: info.defaultMaxTokens
      } : config;
      const reasoning = info.reasoning;
      const requested = defaulted.reasoningEffort;
      let resolvedConfig = defaulted;
      if (reasoning === undefined) {
        if (requested !== undefined)
          throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${requested}"`, "UNSUPPORTED_REASONING_EFFORT");
      } else {
        const effective = requested ?? reasoning.defaultEffort;
        if (effective !== undefined) {
          if (!reasoning.efforts.some((effort) => effort.id === effective))
            throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${effective}"`, "UNSUPPORTED_REASONING_EFFORT");
          if (requested !== effective)
            resolvedConfig = {
              ...defaulted,
              reasoningEffort: effective
            };
        }
      }
      return {
        config: resolvedConfig,
        ...info.context === undefined ? {} : { context: info.context },
        modelInfo: info
      };
    }
    async prepareCall(config, signal, configure) {
      signal?.throwIfAborted();
      const { provider, model, ...controls } = config;
      const registration = this.registration(provider);
      const adapterCall = await registration.adapter.prepareCall(provider, model, signal);
      signal?.throwIfAborted();
      const modelInfo = this.normalizeModelInfo(registration, model, adapterCall.model);
      const proposed = configure === undefined ? config : {
        ...configure(deepFreeze(structuredClone(controls)), deepFreeze(modelInfo)),
        provider,
        model
      };
      signal?.throwIfAborted();
      const resolved = this.resolveCallWithInfo(proposed, modelInfo);
      const resolvedConfig = deepFreeze(structuredClone(resolved.config));
      const context = resolved.context === undefined ? undefined : deepFreeze(structuredClone(resolved.context));
      const adapterDefaults = deepFreeze({
        ...proposed.reasoningEffort === undefined && resolvedConfig.reasoningEffort !== undefined ? { reasoningEffort: true } : {},
        ...proposed.maxTokens === undefined && resolvedConfig.maxTokens !== undefined ? { maxTokens: true } : {}
      });
      let dispatched = false;
      return Object.freeze({
        config: resolvedConfig,
        retryPolicy: registration.retryPolicy,
        adapterDefaults,
        ...context === undefined ? {} : { context },
        ...modelInfo.inputModalities === undefined ? {} : { inputModalities: Object.freeze([...modelInfo.inputModalities]) },
        ...modelInfo.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: modelInfo.systemPromptUpdate },
        ...modelInfo.toolUpdate === undefined ? {} : { toolUpdate: modelInfo.toolUpdate },
        stream: (options) => {
          if (dispatched)
            throw new LlmError("a prepared LLM call can only be dispatched once", "INVALID_PREPARED_CALL");
          if (!callConfigEquals(options, resolvedConfig))
            throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
          dispatched = true;
          return this.streamWithRegistration(options, {
            registration,
            config: resolvedConfig,
            modelInfo,
            dispatch: (options) => adapterCall.stream(options)
          });
        }
      });
    }
    registration(provider) {
      const registration = this.adapters.get(provider);
      if (!registration)
        throw new LlmError(`no adapter registered for provider "${provider}"`, "NO_ADAPTER");
      return registration;
    }
    forAdapter(options, adapter) {
      const messages = options.messages.map((message) => {
        if (message.role !== "assistant")
          return message;
        const source = message.source;
        if (source.replayState === undefined)
          return message;
        if (this.adapters.get(source.provider)?.adapter === adapter)
          return message;
        return freezeMessage({
          ...message,
          source: {
            kind: "model",
            provider: source.provider,
            model: source.model
          }
        });
      });
      if (messages.every((message, index) => message === options.messages[index]))
        return options;
      const filtered = {
        ...options,
        messages
      };
      return Object.isFrozen(options) ? deepFreeze(filtered) : filtered;
    }
    fileReadPath(ref) {
      let hostPath;
      try {
        hostPath = this.ctx.get("attachments")?.fileHostPath(ref);
      } catch {
        return;
      }
      if (hostPath === undefined)
        return;
      return this.ctx.get("fs")?.processPathFromHostPath(hostPath);
    }
    async* adapterStream(options, prepared) {
      let iterator;
      try {
        const registration = prepared?.registration ?? this.registration(options.provider);
        const adapter = registration.adapter;
        let modelInfo;
        let resolvedConfig;
        let dispatch;
        if (prepared === undefined) {
          const adapterCall = await adapter.prepareCall(options.provider, options.model, options.signal);
          modelInfo = this.normalizeModelInfo(registration, options.model, adapterCall.model);
          resolvedConfig = this.resolveCallWithInfo(options, modelInfo).config;
          dispatch = (options) => adapterCall.stream(options);
        } else {
          modelInfo = prepared.modelInfo;
          resolvedConfig = prepared.config;
          dispatch = prepared.dispatch;
        }
        if (prepared !== undefined && !callConfigEquals(options, resolvedConfig))
          throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
        const resolvedOptions = callConfigEquals(options, resolvedConfig) ? options : Object.isFrozen(options) ? deepFreeze({
          ...options,
          ...resolvedConfig
        }) : {
          ...options,
          ...resolvedConfig
        };
        let projectedMessages = resolvedOptions.messages;
        if (projectedMessages.some((message) => contentHasFile(message.content)))
          projectedMessages = projectFilesToText(projectedMessages, (ref) => this.fileReadPath(ref));
        if (modelInfo.inputModalities !== undefined && !modelInfo.inputModalities.includes("image") && projectedMessages.some((message) => contentHasImage(message.content)))
          projectedMessages = projectImagesForTextModel(projectedMessages);
        const projectedTools = projectToolUpdates(projectedMessages, resolvedOptions.tools, modelInfo.toolUpdate, resolvedOptions.toolHistory);
        projectedMessages = projectedTools.messages;
        let projectedOptions = resolvedOptions;
        if (projectedMessages !== resolvedOptions.messages || projectedTools.tools !== resolvedOptions.tools) {
          projectedOptions = {
            ...resolvedOptions,
            messages: projectedMessages,
            ...projectedTools.tools === undefined ? {} : { tools: projectedTools.tools }
          };
          if (Object.isFrozen(resolvedOptions))
            deepFreeze(projectedOptions);
        }
        iterator = dispatch(this.forAdapter(projectedOptions, adapter))[Symbol.asyncIterator]();
      } catch (error) {
        yield adapterFailureChunk(error, options.signal);
        return;
      }
      let completed = false;
      try {
        while (true) {
          let item;
          try {
            const next = await iterator.next();
            item = next.done ? { done: true } : {
              done: false,
              value: next.value
            };
          } catch (error) {
            completed = true;
            yield adapterFailureChunk(error, options.signal);
            return;
          }
          if (item.done) {
            completed = true;
            return;
          }
          yield item.value;
        }
      } finally {
        if (!completed) {
          const close = iterator.return?.bind(iterator);
          if (close)
            await close();
        }
      }
    }
    stream(options) {
      return this.streamWithRegistration(options);
    }
    streamWithRegistration(options, prepared) {
      return this.ctx.waterfall(this, "llm/stream", options, () => this.adapterStream(options, prepared));
    }
  };
})();
function adapterFailureChunk(error, signal) {
  const failure = normalizeLlmFailure(error);
  return {
    type: "finish",
    reason: signal?.aborted || failure.code === "ABORTED" ? {
      kind: "aborted",
      failure
    } : {
      kind: "error",
      failure
    }
  };
}
function detachDirectoryEntry(entry) {
  const { nativeAuth } = entry;
  return {
    ...entry,
    settingsPath: [...entry.settingsPath],
    ...entry.baseURLEnv === undefined ? {} : { baseURLEnv: [...entry.baseURLEnv] },
    ...nativeAuth === undefined ? {} : { nativeAuth: {
      ...nativeAuth,
      env: [...nativeAuth.env]
    } }
  };
}

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-tools/lib/shared-DTdn5dXO.js
var ToolExecutorUnavailableError = class extends HarnessError {
  constructor() {
    super("The selected tool executor is unavailable. Load an executor in this composition before running the agent.", "TOOL_EXECUTOR_UNAVAILABLE");
    this.name = "ToolExecutorUnavailableError";
  }
};
var JsonSchemaError = class extends HarnessError {
  violations;
  constructor(violations) {
    super(`unsupported JSON schema: ${violations.join("; ")}`, "UNSUPPORTED_SCHEMA");
    this.name = "JsonSchemaError";
    this.violations = violations;
  }
};
var CONSTRAINT_KEYWORDS = new Set([
  "type",
  "oneOf",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const"
]);
var ANNOTATION_KEYWORDS = new Set([
  "description",
  "title",
  "default",
  "examples"
]);
var SCHEMA_TYPES = [
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null"
];
function hasIntrinsicConstructor2(prototype, name) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function")
    return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype2(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor2(value, "Object");
}
function isPlainJsonRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype2(prototype);
  } catch {
    return false;
  }
}
function hasPlainArrayPrototype2(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor2(prototype, "Array"))
    return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype2(objectPrototype);
}
function hasOnlyEnumerableStringKeys(value) {
  try {
    return Reflect.ownKeys(value).every((key) => typeof key === "string" && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch {
    return false;
  }
}
function isJsonSchemaRecord(value) {
  return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}
function isPlainJsonArray(value) {
  if (!Array.isArray(value))
    return false;
  try {
    if (!hasPlainArrayPrototype2(value) || Reflect.ownKeys(value).length !== value.length + 1)
      return false;
    for (let index = 0;index < value.length; index++)
      if (!Object.hasOwn(value, index))
        return false;
    return true;
  } catch {
    return false;
  }
}
function isJsonNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}
function scalarMatches(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return isJsonNumber(value);
    case "integer":
      return isJsonNumber(value) && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return assertNever(type, "JsonSchemaType");
  }
}
var ONE_OF_SIBLING_KEYWORDS = [
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const"
];
function checkObjectSchemaTail(node, path, properties, violations) {
  const hasRequired = Object.hasOwn(node, "required");
  const required = hasRequired ? node.required : undefined;
  if (hasRequired)
    if (!isPlainJsonArray(required) || required.some((entry) => typeof entry !== "string"))
      violations.push(`${path}.required must be an array of strings`);
    else {
      const declared = isJsonSchemaRecord(properties) ? properties : {};
      for (const key of required)
        if (!Object.hasOwn(declared, key))
          violations.push(`${path}.required names "${key}" which is not in properties`);
    }
  if (Object.hasOwn(node, "additionalProperties") && typeof node.additionalProperties !== "boolean")
    violations.push(`${path}.additionalProperties must be a boolean`);
}
function checkSchemaNode(root, rootPath, violations, seen) {
  const tasks = [{
    kind: "enter",
    node: root,
    path: rootPath
  }];
  for (let task = tasks.pop();task !== undefined; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.node);
      continue;
    }
    if (task.kind === "one-of-tail") {
      for (const key of ONE_OF_SIBLING_KEYWORDS)
        if (Object.hasOwn(task.node, key))
          violations.push(`${task.path}.${key} is not supported beside oneOf`);
      continue;
    }
    if (task.kind === "object-tail") {
      checkObjectSchemaTail(task.node, task.path, task.properties, violations);
      continue;
    }
    const { node, path } = task;
    if (!isJsonSchemaRecord(node)) {
      violations.push(`${path} must be a schema object`);
      continue;
    }
    if (seen.has(node)) {
      violations.push(`${path} is circular`);
      continue;
    }
    seen.add(node);
    tasks.push({
      kind: "leave",
      node
    });
    for (const key of Object.keys(node)) {
      if (CONSTRAINT_KEYWORDS.has(key))
        continue;
      if (ANNOTATION_KEYWORDS.has(key)) {
        try {
          if (!isJsonValue(node[key]))
            violations.push(`${path}.${key} annotation must be lossless JSON data`);
        } catch {
          violations.push(`${path}.${key} annotation must be lossless JSON data`);
        }
        continue;
      }
      violations.push(`${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`);
    }
    if (Object.hasOwn(node, "description") && typeof node.description !== "string")
      violations.push(`${path}.description must be a string`);
    if (Object.hasOwn(node, "title") && typeof node.title !== "string")
      violations.push(`${path}.title must be a string`);
    const hasType = Object.hasOwn(node, "type");
    const hasOneOf = Object.hasOwn(node, "oneOf");
    if (hasType && hasOneOf) {
      violations.push(`${path} cannot declare both type and oneOf`);
      continue;
    }
    if (!hasType && !hasOneOf) {
      for (const key of ONE_OF_SIBLING_KEYWORDS)
        if (Object.hasOwn(node, key))
          violations.push(`${path}.${key} requires type or oneOf`);
      continue;
    }
    if (hasOneOf) {
      const oneOf = node.oneOf;
      tasks.push({
        kind: "one-of-tail",
        node,
        path
      });
      if (!isPlainJsonArray(oneOf) || oneOf.length < 2)
        violations.push(`${path}.oneOf must be an array of at least two schemas`);
      else
        for (let index = oneOf.length - 1;index >= 0; index--)
          tasks.push({
            kind: "enter",
            node: oneOf[index],
            path: `${path}.oneOf[${index}]`
          });
      continue;
    }
    const type = node.type;
    if (typeof type !== "string" || !SCHEMA_TYPES.includes(type)) {
      violations.push(Array.isArray(type) ? `${path}.type must be a single type string (type arrays are not supported)` : `${path}.type must be one of ${SCHEMA_TYPES.join("/")}`);
      continue;
    }
    const schemaType = type;
    for (const [key, types] of Object.entries({
      properties: ["object"],
      required: ["object"],
      additionalProperties: ["object"],
      items: ["array"],
      enum: [
        "string",
        "number",
        "integer",
        "boolean",
        "null"
      ],
      const: [
        "string",
        "number",
        "integer",
        "boolean",
        "null"
      ]
    }))
      if (Object.hasOwn(node, key) && !types.includes(schemaType))
        violations.push(`${path}.${key} is not supported on type "${schemaType}"`);
    switch (schemaType) {
      case "object": {
        const properties = Object.hasOwn(node, "properties") ? node.properties : undefined;
        tasks.push({
          kind: "object-tail",
          node,
          path,
          properties
        });
        if (Object.hasOwn(node, "properties"))
          if (!isJsonSchemaRecord(properties))
            violations.push(`${path}.properties must be an object of schemas`);
          else {
            const entries = Object.entries(properties);
            for (let index = entries.length - 1;index >= 0; index--) {
              const entry = entries[index];
              if (entry === undefined)
                continue;
              tasks.push({
                kind: "enter",
                node: entry[1],
                path: `${path}.properties.${entry[0]}`
              });
            }
          }
        break;
      }
      case "array":
        if (Object.hasOwn(node, "items"))
          tasks.push({
            kind: "enter",
            node: node.items,
            path: `${path}.items`
          });
        break;
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null": {
        const hasEnum = Object.hasOwn(node, "enum");
        const allowed = hasEnum ? node.enum : undefined;
        const enumValid = isPlainJsonArray(allowed) && allowed.length > 0 && allowed.every((entry) => scalarMatches(schemaType, entry));
        if (hasEnum && !enumValid)
          violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`);
        const hasConst = Object.hasOwn(node, "const");
        const declaredConst = hasConst ? node.const : undefined;
        const constValid = scalarMatches(schemaType, declaredConst);
        if (hasConst) {
          if (!constValid)
            violations.push(`${path}.const must be a ${schemaType} value`);
          else if (enumValid && !allowed.includes(declaredConst))
            violations.push(`${path}.const must be one of ${path}.enum when both are declared`);
        }
        break;
      }
      default:
        assertNever(schemaType, "JsonSchemaType");
    }
  }
}
function assertSupportedJsonSchema(schema) {
  const violations = [];
  checkSchemaNode(schema, "schema", violations, /* @__PURE__ */ new Set);
  if (violations.length > 0)
    throw new JsonSchemaError(violations);
}
function safelyIsJsonValue(value) {
  try {
    return isJsonValue(value);
  } catch {
    return false;
  }
}
function diagnosticPath(path) {
  return path === "" ? "arguments" : path;
}
function propertyPath(path, key) {
  return path === "" ? key : `${path}.${key}`;
}
function losslessValueViolation(path) {
  return [`"${diagnosticPath(path)}" must be a lossless JSON value`];
}
function appendViolations(target, source) {
  for (const violation of source)
    target.push(violation);
}
function valueFrame(node, value, path) {
  return {
    node,
    value,
    path,
    catches: false,
    phase: "start",
    children: [],
    childIndex: 0,
    violations: [],
    tailViolations: [],
    matches: 0
  };
}
function checkScalarValue(node, value, path) {
  const allowed = Object.hasOwn(node, "enum") ? node.enum : undefined;
  if (allowed !== undefined && !allowed.includes(value))
    return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`];
  if (Object.hasOwn(node, "const") && value !== node.const)
    return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`];
  return [];
}
function checkValue(schema, value, path) {
  const frames = [valueFrame(schema, value, path)];
  let rootResult;
  const receive = (result) => {
    const parent = frames.at(-1);
    if (parent === undefined) {
      rootResult = result;
      return;
    }
    if (parent.kind === "oneOf") {
      if (result.length === 0)
        parent.matches++;
    } else
      appendViolations(parent.violations, result);
  };
  const finish = (result) => {
    frames.pop();
    receive(result);
  };
  while (frames.length > 0) {
    const frame = frames.at(-1);
    if (frame === undefined)
      break;
    try {
      if (frame.phase === "children") {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          if (child === undefined)
            throw new Error("missing schema-value child frame");
          frame.childIndex++;
          frames.push(valueFrame(child.node, child.value, child.path));
          continue;
        }
        if (frame.kind === "oneOf") {
          finish(frame.matches === 1 ? [] : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`]);
          continue;
        }
        appendViolations(frame.violations, frame.tailViolations);
        if (frame.violations.length > 0)
          finish(frame.violations);
        else if (frame.kind === "object")
          finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`]);
        else
          finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`]);
        continue;
      }
      const nodeType = Object.hasOwn(frame.node, "type") ? frame.node.type : undefined;
      frame.catches = !(nodeType !== undefined && !SCHEMA_TYPES.includes(nodeType));
      const oneOf = Object.hasOwn(frame.node, "oneOf") ? frame.node.oneOf : undefined;
      if (oneOf !== undefined) {
        frame.kind = "oneOf";
        frame.children = Array.from(oneOf, (branch) => ({
          node: branch,
          value: frame.value,
          path: frame.path
        }));
        frame.childIndex = 0;
        frame.matches = 0;
        frame.phase = "children";
        continue;
      }
      if (nodeType === undefined) {
        finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
        continue;
      }
      switch (nodeType) {
        case "object": {
          if (!isPlainJsonRecord(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an object`]);
            break;
          }
          const properties = Object.hasOwn(frame.node, "properties") ? frame.node.properties ?? {} : {};
          const violations = [];
          const required = Object.hasOwn(frame.node, "required") ? frame.node.required ?? [] : [];
          for (const key of required)
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined)
              violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
          const children = [];
          for (const [key, child] of Object.entries(properties)) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined)
              continue;
            children.push({
              node: child,
              value: frame.value[key],
              path: propertyPath(frame.path, key)
            });
          }
          const tailViolations = [];
          if (Object.hasOwn(frame.node, "additionalProperties") && frame.node.additionalProperties === false) {
            for (const key of Object.keys(frame.value))
              if (!Object.hasOwn(properties, key))
                tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`);
          }
          frame.kind = "object";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = violations;
          frame.tailViolations = tailViolations;
          frame.phase = "children";
          break;
        }
        case "array": {
          if (!Array.isArray(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an array`]);
            break;
          }
          const items = Object.hasOwn(frame.node, "items") ? frame.node.items : undefined;
          const children = items === undefined ? [] : frame.value.flatMap((entry, index) => [{
            node: items,
            value: entry,
            path: `${frame.path}[${index}]`
          }]);
          frame.kind = "array";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = [];
          frame.phase = "children";
          break;
        }
        case "string":
          finish(typeof frame.value === "string" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a string`]);
          break;
        case "number":
          finish(typeof frame.value !== "number" ? [`"${diagnosticPath(frame.path)}" must be a number`] : !isJsonNumber(frame.value) ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`] : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case "integer":
          finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value) ? [`"${diagnosticPath(frame.path)}" must be an integer`] : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case "boolean":
          finish(typeof frame.value === "boolean" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a boolean`]);
          break;
        case "null":
          finish(frame.value === null ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be null`]);
          break;
        default:
          finish(assertNever(nodeType, "JsonSchemaType"));
      }
    } catch (error) {
      let failed = frames.pop();
      while (failed !== undefined && !failed.catches)
        failed = frames.pop();
      if (failed === undefined)
        throw error;
      receive(losslessValueViolation(failed.path));
    }
  }
  return rootResult ?? losslessValueViolation(path);
}
function validateJsonSchemaValue(schema, value, path = "value") {
  return checkValue(schema, value, path);
}
var RUN_CODE_NAME = "run_code";
var ToolActivationError = class extends HarnessError {
  constructor(name, cause) {
    super(`cannot resolve availability of tool "${name}"`, "TOOL_ACTIVATION_FAILED", { cause });
    this.name = "ToolActivationError";
  }
};

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-scope/lib/index.js
var NamedEntries = class {
  duplicateError;
  data = /* @__PURE__ */ new Map;
  constructor(duplicateError) {
    this.duplicateError = duplicateError;
  }
  insert(name, value) {
    const data = this.data;
    if (data.has(name))
      throw this.duplicateError(name);
    data.set(name, value);
    let active = true;
    return () => {
      if (!active)
        return;
      active = false;
      data.delete(name);
      if (data.size === 0 && this.data === data)
        this.data = /* @__PURE__ */ new Map;
    };
  }
  get(name) {
    return this.data.get(name);
  }
  has(name) {
    return this.data.has(name);
  }
  keys() {
    return this.data.keys();
  }
  entries() {
    return this.data.entries();
  }
  values() {
    return this.data.values();
  }
  isEmpty() {
    return this.data.size === 0;
  }
};
var AnonymousEntries = class {
  data = /* @__PURE__ */ new Map;
  append(value) {
    const data = this.data;
    const key = Symbol();
    data.set(key, value);
    let active = true;
    return () => {
      if (!active)
        return;
      active = false;
      data.delete(key);
      if (data.size === 0 && this.data === data)
        this.data = /* @__PURE__ */ new Map;
    };
  }
  values() {
    return this.data.values();
  }
  isEmpty() {
    return this.data.size === 0;
  }
};
var ScopedLayers = class {
  createLayer;
  onChange;
  global;
  scoped = /* @__PURE__ */ new Map;
  constructor(createLayer, onChange) {
    this.createLayer = createLayer;
    this.onChange = onChange;
    this.global = createLayer(undefined);
  }
  peek(scope) {
    if (scope === undefined)
      return;
    return this.scoped.get(scope);
  }
  chainLayers(scope) {
    const layers = [];
    for (const key of scopeChainOf(scope).reverse()) {
      const layer = this.scoped.get(key);
      if (layer !== undefined)
        layers.push(layer);
    }
    return layers;
  }
  merge(scope, pick) {
    const merged = new Map(pick(this.global).entries());
    for (const layer of this.chainLayers(scope))
      for (const [name, value] of pick(layer).entries())
        merged.set(name, value);
    return merged;
  }
  effect(ctx, action, options) {
    const scope = scopeOf(ctx);
    const notify = options.notify ?? true;
    return ctx.effect(function* () {
      let layer;
      let created = false;
      if (scope === undefined)
        layer = this.global;
      else {
        const existing = this.scoped.get(scope);
        if (existing === undefined) {
          layer = this.createLayer(scope);
          this.scoped.set(scope, layer);
          created = true;
        } else
          layer = existing;
      }
      let undo;
      try {
        undo = action(layer);
      } catch (error) {
        if (scope !== undefined && created && layer.isEmpty())
          this.scoped.delete(scope);
        throw error;
      }
      yield () => {
        undo();
        if (scope !== undefined && layer.isEmpty())
          this.scoped.delete(scope);
        if (notify)
          this.onChange();
      };
      if (notify)
        this.onChange();
    }.bind(this), options.label);
  }
};
var kScope = Symbol("dsh.scope");
var scopeParents = /* @__PURE__ */ new WeakMap;
function scopeChainOf(key) {
  const chain = [];
  for (let cursor = key;cursor !== undefined; cursor = scopeParents.get(cursor))
    chain.push(cursor);
  return chain;
}
function scopeOf(ctx) {
  return ctx[kScope];
}

// ../../.bun/install/global/node_modules/@deepseek-ai/dsh-tools/lib/index.js
var ANNOTATION_KEYS = [
  "description",
  "title",
  "default",
  "examples"
];
function authorError(message) {
  throw new JsonSchemaError([message]);
}
function copyAnnotations(source, target) {
  if (Object.hasOwn(source, "description"))
    target.description = source.description;
  if (Object.hasOwn(source, "title"))
    target.title = source.title;
  if (Object.hasOwn(source, "default"))
    target.default = source.default;
  if (Object.hasOwn(source, "examples"))
    target.examples = source.examples;
}
function assertAuthorKeys(source, path, allowed) {
  for (const key of Object.keys(source))
    if (!allowed.includes(key))
      authorError(`${path}.${key} is not supported by the value schema DSL`);
}
function assignCompiledNode(destination, node) {
  switch (destination.kind) {
    case "root":
      destination.holder.value = node;
      break;
    case "property":
      Object.defineProperty(destination.target, destination.key, {
        value: node,
        enumerable: true,
        configurable: true,
        writable: true
      });
      break;
    case "item":
      destination.target.items = node;
      break;
    case "one-of":
      destination.target[destination.index] = node;
      break;
  }
}
function assignCompiledPropertyMap(destination, compiled) {
  if (destination.kind === "root")
    destination.holder.value = compiled;
  else
    destination.target.properties = compiled.properties;
}
function runSchemaCompiler(initial) {
  const seen = /* @__PURE__ */ new Set;
  const tasks = [initial];
  for (let task = tasks.pop();task !== undefined; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.input);
      continue;
    }
    if (task.kind === "property-map-tail") {
      if (task.required.length > 0) {
        task.compiled.required = task.required;
        if (task.destination.kind === "object")
          task.destination.target.required = task.required;
      }
      continue;
    }
    if (task.kind === "property") {
      if (!isJsonSchemaRecord(task.property))
        authorError(`${task.path} must be a value schema object`);
      if (Object.hasOwn(task.property, "required") && task.property.required !== true)
        authorError(`${task.path}.required must be true when present`);
      if (Object.hasOwn(task.property, "required") && task.property.required === true)
        task.required.push(task.key);
      tasks.push({
        kind: "value",
        input: task.property,
        path: task.path,
        allowRequired: true,
        destination: {
          kind: "property",
          target: task.properties,
          key: task.key
        }
      });
      continue;
    }
    if (task.kind === "property-map") {
      if (!isJsonSchemaRecord(task.input))
        authorError(`${task.path} must be an object of value schemas`);
      if (seen.has(task.input))
        authorError(`${task.path} is circular`);
      seen.add(task.input);
      const compiled = { properties: {} };
      const required = [];
      assignCompiledPropertyMap(task.destination, compiled);
      tasks.push({
        kind: "leave",
        input: task.input
      });
      tasks.push({
        kind: "property-map-tail",
        compiled,
        required,
        destination: task.destination
      });
      const entries = Object.entries(task.input);
      for (let index = entries.length - 1;index >= 0; index--) {
        const entry = entries[index];
        if (entry === undefined)
          continue;
        tasks.push({
          kind: "property",
          property: entry[1],
          path: `${task.path}.${entry[0]}`,
          key: entry[0],
          properties: compiled.properties,
          required
        });
      }
      continue;
    }
    const { input, path } = task;
    if (!isJsonSchemaRecord(input))
      authorError(`${path} must be a value schema object`);
    if (seen.has(input))
      authorError(`${path} is circular`);
    seen.add(input);
    const authorKeys = [...ANNOTATION_KEYS, ...task.allowRequired ? ["required"] : []];
    const node = {};
    assignCompiledNode(task.destination, node);
    tasks.push({
      kind: "leave",
      input
    });
    if (Object.hasOwn(input, "oneOf")) {
      assertAuthorKeys(input, path, [
        ...authorKeys,
        "oneOf",
        "type"
      ]);
      if (Object.hasOwn(input, "type"))
        authorError(`${path} cannot declare both type and oneOf`);
      if (!isPlainJsonArray(input.oneOf))
        authorError(`${path}.oneOf must be an array of at least two value schemas`);
      const branches = [];
      node.oneOf = branches;
      copyAnnotations(input, node);
      for (let index = input.oneOf.length - 1;index >= 0; index--)
        tasks.push({
          kind: "value",
          input: input.oneOf[index],
          path: `${path}.oneOf[${index}]`,
          allowRequired: false,
          destination: {
            kind: "one-of",
            target: branches,
            index
          }
        });
      continue;
    }
    const inputType = Object.hasOwn(input, "type") ? input.type : undefined;
    switch (inputType) {
      case "json":
        assertAuthorKeys(input, path, [...authorKeys, "type"]);
        copyAnnotations(input, node);
        break;
      case "object":
        assertAuthorKeys(input, path, [
          ...authorKeys,
          "type",
          "properties",
          "additionalProperties"
        ]);
        if (!Object.hasOwn(input, "additionalProperties") || typeof input.additionalProperties !== "boolean")
          authorError(`${path}.additionalProperties must be explicitly true or false`);
        node.type = "object";
        copyAnnotations(input, node);
        node.additionalProperties = input.additionalProperties;
        if (Object.hasOwn(input, "properties"))
          tasks.push({
            kind: "property-map",
            input: input.properties,
            path: `${path}.properties`,
            destination: {
              kind: "object",
              target: node
            }
          });
        break;
      case "array":
        assertAuthorKeys(input, path, [
          ...authorKeys,
          "type",
          "items"
        ]);
        node.type = "array";
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "items"))
          tasks.push({
            kind: "value",
            input: input.items,
            path: `${path}.items`,
            allowRequired: false,
            destination: {
              kind: "item",
              target: node
            }
          });
        break;
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null":
        assertAuthorKeys(input, path, [
          ...authorKeys,
          "type",
          "enum",
          "const"
        ]);
        node.type = inputType;
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "enum")) {
          if (!isPlainJsonArray(input.enum))
            authorError(`${path}.enum must be a non-empty array of scalar values`);
          node.enum = Array.from(input.enum, (entry) => entry);
        }
        if (Object.hasOwn(input, "const"))
          node.const = input.const;
        break;
      default:
        authorError(`${path}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`);
    }
  }
}
function compilePropertyMap(input, path) {
  const holder = {};
  runSchemaCompiler({
    kind: "property-map",
    input,
    path,
    destination: {
      kind: "root",
      holder
    }
  });
  return holder.value ?? authorError(`${path} did not compile`);
}
function compileValueSchema(input, path) {
  const holder = {};
  runSchemaCompiler({
    kind: "value",
    input,
    path,
    allowRequired: false,
    destination: {
      kind: "root",
      holder
    }
  });
  return holder.value ?? authorError(`${path} did not compile`);
}
function valueSchemaSpecToJsonSchema(spec) {
  const schema = compileValueSchema(spec, "schema");
  assertSupportedJsonSchema(schema);
  return schema;
}
function parameterSchemaSpecToJsonSchema(spec) {
  const compiled = compilePropertyMap(spec, "parameters");
  const schema = {
    type: "object",
    properties: compiled.properties,
    ...compiled.required === undefined ? {} : { required: compiled.required }
  };
  assertSupportedJsonSchema(schema);
  return schema;
}
var ToolArgsError = class extends HarnessError {
  violations;
  constructor(violations) {
    super(`invalid arguments: ${violations.join("; ")}`, "INVALID_ARGS");
    this.name = "ToolArgsError";
    this.violations = violations;
  }
};
function defineTool(options) {
  const userExecute = options.execute;
  const userFinalizeContent = options.finalizeContent;
  const userProjectContent = options.projectContent;
  const userRender = options.output.render;
  const userPresentationMeta = options.output.presentationMeta;
  const userPresentCall = options.presentCall;
  const userPresentResult = options.presentResult;
  const userIsConcurrencySafe = options.isConcurrencySafe;
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0))
    throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
  const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
  const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
  const validate = (args) => validateJsonSchemaValue(parameters, args, "");
  const tool = {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: outputSchema,
      render(args, value) {
        return userRender(args, value);
      },
      ...userPresentationMeta !== undefined ? { presentationMeta(args, value) {
        return userPresentationMeta(args, value);
      } } : {}
    },
    ...options.deferLoading === true ? { deferLoading: options.deferLoading } : {},
    ...options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {},
    async execute(args, exec) {
      const violations = validate(args);
      if (violations.length > 0)
        throw new ToolArgsError(violations);
      return userExecute(args, exec);
    }
  };
  if (userProjectContent)
    tool.projectContent = (exec, result) => userProjectContent(exec, result);
  if (userFinalizeContent)
    tool.finalizeContent = (exec, result) => userFinalizeContent(exec, result);
  if (userPresentCall)
    tool.presentCall = (args) => {
      if (validate(args).length > 0)
        return;
      return userPresentCall(args);
    };
  if (userPresentResult)
    tool.presentResult = (args, result) => {
      if (validate(args).length > 0)
        return;
      return userPresentResult(args, result);
    };
  if (userIsConcurrencySafe)
    tool.isConcurrencySafe = (args) => {
      if (validate(args).length > 0)
        return false;
      return userIsConcurrencySafe(args);
    };
  return tool;
}
function projectToolSchema(definition, detachParameters) {
  const { name, description, parameters, deferLoading } = definition;
  const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
  if (detached === undefined)
    throw new Error(`tool "${name}" parameters must be lossless JSON before schema projection`);
  return {
    name,
    description,
    parameters: detached,
    ...deferLoading === true ? { deferLoading } : {}
  };
}
var ToolLayer = class {
  tools;
  restrictions = new AnonymousEntries;
  constructor(scope) {
    this.tools = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === undefined ? `tool "${name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)` : `tool "${name}" is already registered in this scope`));
  }
  isEmpty() {
    return this.tools.isEmpty() && this.restrictions.isEmpty();
  }
  admits(name) {
    for (const filter of this.restrictions.values())
      if (filter.allow !== undefined && !filter.allow.has(name) || filter.deny !== undefined && filter.deny.has(name))
        return false;
    return true;
  }
};
var GuardLayer = class {
  guards = new AnonymousEntries;
  isEmpty() {
    return this.guards.isEmpty();
  }
};
var ToolsService = class extends Service {
  static inject = ["systemPrompt"];
  static Config = Schema.object({
    mode: Schema.never().description("Removed. Mount a native or PTC tool executor instead."),
    maxParallelSubCalls: Schema.never().description("Moved to the PTC tool executor configuration.")
  });
  layers = new ScopedLayers((scope) => new ToolLayer(scope), () => {
    this.ctx.emit("tools/change");
  });
  scoped = /* @__PURE__ */ new WeakMap;
  root;
  guards = new ScopedLayers(() => new GuardLayer, () => {});
  constructor(ctx) {
    super(ctx, "tools");
    ctx.systemPrompt.tools(({ scope, toolSet }) => {
      const description = this.selectExecutor(scope).describe(this.definitions(scope, toolSet));
      return {
        ...description,
        knownNames: description.knownNames ?? [...this.view(scope).knownNames]
      };
    });
  }
  register(definition, options = {}) {
    const name = definition.name;
    const output = definition.output;
    if (output === undefined || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== undefined && typeof output.presentationMeta !== "function")
      throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
    assertSupportedJsonSchema(output.schema);
    const timeoutMs = definition.timeoutMs;
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0))
      throw new TypeError(`tool "${name}" timeoutMs must be a positive finite number`);
    if (name === "run_code")
      throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
    return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, {
      definition,
      when: options.when
    }), { label: "tools.register()" });
  }
  restrict(filter) {
    const scope = scopeOf(this.ctx);
    if (scope === undefined)
      throw new Error("tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead");
    const allow = filter.allow;
    const deny = filter.deny;
    if (allow === undefined && deny === undefined)
      throw new Error("tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)");
    const compiled = {
      ...allow !== undefined ? { allow: new Set(allow) } : {},
      ...deny !== undefined ? { deny: new Set(deny) } : {}
    };
    if ([...allow ?? [], ...deny ?? []].includes("run_code"))
      throw new Error(`tools.restrict() cannot name reserved PTC mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
    const known = this.view(scope).restrictableNames;
    const unknown = [...allow ?? [], ...deny ?? []].filter((name) => !known.has(name));
    if (unknown.length > 0)
      throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? "s" : ""} ${unknown.map((n) => `"${n}"`).join(", ")}; known global tools: ${[...known].sort().join(", ") || "(none)"}`);
    return this.layers.effect(this.ctx, (layer) => layer.restrictions.append(compiled), { label: "tools.restrict()" });
  }
  view(scope) {
    const layers = this.layers.chainLayers(scope);
    const own = this.layers.peek(scope);
    const inherited = new Map(this.layers.global.tools.entries());
    for (const layer of layers) {
      if (layer === own)
        continue;
      for (const [name, registration] of layer.tools.entries())
        inherited.set(name, registration);
    }
    const visible = /* @__PURE__ */ new Map;
    const registrations = /* @__PURE__ */ new Map;
    const knownNames = /* @__PURE__ */ new Set;
    const restrictableNames = /* @__PURE__ */ new Set;
    for (const [name, registration] of inherited) {
      knownNames.add(name);
      restrictableNames.add(name);
      if (layers.every((layer) => layer.admits(name))) {
        visible.set(name, registration.definition);
        registrations.set(name, registration);
      }
    }
    if (own !== undefined)
      for (const [name, registration] of own.tools.entries()) {
        knownNames.add(name);
        visible.set(name, registration.definition);
        registrations.set(name, registration);
      }
    return {
      visible,
      registrations,
      knownNames,
      restrictableNames
    };
  }
  get(name, scope, toolSet) {
    return toolSet === undefined ? this.view(scope).visible.get(name) : toolSet.view(scope).get(name);
  }
  executable(name, scope, toolSet) {
    if (toolSet !== undefined)
      return toolSet.view(scope).get(name);
    const view = this.view(scope);
    return view.registrations.get(name)?.when === undefined ? view.visible.get(name) : undefined;
  }
  async resolve(context) {
    const { agent, signal } = context;
    signal.throwIfAborted();
    const view = this.view(agent);
    const admitted = /* @__PURE__ */ new Map;
    for (const [name, definition] of view.visible) {
      const registration = view.registrations.get(name);
      let enabled;
      try {
        enabled = registration?.when === undefined || await registration.when(context);
      } catch (cause) {
        signal.throwIfAborted();
        throw new ToolActivationError(name, cause);
      }
      signal.throwIfAborted();
      if (enabled)
        admitted.set(name, definition);
    }
    let closed = false;
    return Object.freeze({
      dispose: () => {
        closed = true;
      },
      view: (scope) => {
        const visible = /* @__PURE__ */ new Map;
        if (closed || scope !== agent)
          return visible;
        const current = this.view(agent);
        for (const [name, definition] of admitted)
          if (current.visible.get(name) === definition && current.registrations.get(name) === view.registrations.get(name))
            visible.set(name, definition);
        return visible;
      }
    });
  }
  definitions(scope, toolSet) {
    return toolSet === undefined ? [...this.view(scope).visible.values()] : [...toolSet.view(scope).values()];
  }
  schemas(scope, toolSet) {
    return this.definitions(scope, toolSet).map((definition) => projectToolSchema(definition, true));
  }
  setExecutor(executor) {
    const scope = scopeOf(this.ctx);
    if ((scope === undefined ? this.root : this.scoped.get(scope))?.executor !== undefined)
      throw new Error("Only one tool executor may be registered in each scope");
    const record = { executor };
    return this.ctx.effect(function* () {
      for (const section of executor.sections ?? [])
        yield this.ctx.systemPrompt.section({
          name: section.name,
          order: section.order,
          ...section.interpolate === undefined ? {} : { interpolate: section.interpolate },
          text: ({ scope, toolSet }) => {
            if (this.selectExecutor(scope) !== executor)
              return "";
            return typeof section.text === "function" ? section.text(this.definitions(scope, toolSet)) : section.text;
          }
        });
      if (scope === undefined)
        this.root = record;
      else
        this.scoped.set(scope, record);
      yield () => {
        record.executor = undefined;
      };
    }.bind(this), "tools.setExecutor()");
  }
  selectExecutor(scope) {
    let record;
    for (const key of scopeChainOf(scope)) {
      record = this.scoped.get(key);
      if (record !== undefined)
        break;
    }
    record ??= this.root;
    const executor = record?.executor;
    if (executor === undefined)
      throw new ToolExecutorUnavailableError;
    return executor;
  }
  async execute(input) {
    return this.selectExecutor(input.agent).execute(input);
  }
  guard(guard) {
    return this.guards.effect(this.ctx, (layer) => layer.guards.append(guard), { label: "tools.guard()" });
  }
  checkGuards(exec) {
    for (const layer of [this.guards.global, ...this.guards.chainLayers(exec.agent)])
      for (const guard of layer.guards.values()) {
        const reason = guard(exec);
        if (reason !== undefined)
          return reason;
      }
  }
};

// src/host/tools.ts
var jsonRender = (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }];
var asJsonOutput = (value) => value;
function registerCodeIntelTools(ctx, service) {
  ctx.tools.register(defineTool({
    name: "find_symbol",
    description: "Find symbols of the project by name path (e.g. `Account.deposit`, or a plain name for a suffix match). Returns matches with kind, file, and exact location. Use substring matching for partial names.",
    parameters: {
      namePathPattern: {
        type: "string",
        required: true,
        description: "Symbol name or dotted name path to find; matched exactly or as a suffix (`deposit` matches `Account.deposit`)."
      },
      relativePath: {
        type: "string",
        description: "Limit the search to this project-relative file."
      },
      substringMatching: {
        type: "boolean",
        description: "Case-insensitive substring match instead of exact/suffix matching."
      },
      includeKinds: {
        type: "array",
        description: "Only include these LSP symbol kinds (5 Class, 11 Interface, 12 Function, 13 Variable, 6 Method, 8 Field, ...).",
        items: { type: "integer" }
      },
      excludeKinds: {
        type: "array",
        description: "Exclude these LSP symbol kinds.",
        items: { type: "integer" }
      },
      maxMatches: {
        type: "integer",
        description: "Cap the number of matches; negative (default) means no cap."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      const hits = await service.searchSymbols(args.namePathPattern, {
        substring: args.substringMatching,
        includeKinds: args.includeKinds,
        excludeKinds: args.excludeKinds,
        maxMatches: args.maxMatches,
        relativePath: args.relativePath
      }, undefined, exec.agent, exec.signal);
      return asJsonOutput({ symbols: hits });
    }
  }));
  ctx.tools.register(defineTool({
    name: "find_referencing_symbols",
    description: "Find every reference to a symbol across the project (call sites, usages), resolved through the language server. Pass the symbol name path as shown by find_symbol or get_symbols_overview.",
    parameters: {
      namePath: {
        type: "string",
        required: true,
        description: "Dotted name path of the symbol, e.g. `Account.deposit`."
      },
      relativePath: {
        type: "string",
        description: "Project-relative file of the symbol, to disambiguate same-named symbols."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      return asJsonOutput(await service.findReferencingSymbols(args.namePath, { relativePath: args.relativePath }, undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "find_implementations",
    description: "Find all implementations of an interface or abstract class (language-server resolved).",
    parameters: {
      namePath: {
        type: "string",
        required: true,
        description: "Dotted name path of the interface or abstract class."
      },
      relativePath: {
        type: "string",
        description: "Project-relative file of the symbol, to disambiguate same-named symbols."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      return asJsonOutput(await service.findImplementations(args.namePath, { relativePath: args.relativePath }, undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "get_symbols_overview",
    description: "Get an overview of the symbols defined in a file, grouped by kind and containment. This should be the first tool to understand a file (Serena guidance), before reading the full content.",
    parameters: {
      relativePath: {
        type: "string",
        required: true,
        description: "Project-relative path of the file (e.g. `src/host/service.ts`)."
      },
      depth: {
        type: "integer",
        description: "Depth up to which nested symbols are included; -1 (default) uses a language-specific choice."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      return asJsonOutput(await service.getSymbolsOverview(args.relativePath, args.depth, undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "get_symbol_details",
    description: "Get every property of one symbol: kind, location, exported/async/static modifiers, container, children, signature/documentation, and optionally the declaration body.",
    parameters: {
      namePath: {
        type: "string",
        required: true,
        description: "Dotted name path of the symbol, e.g. `Account.deposit`."
      },
      relativePath: {
        type: "string",
        description: "Project-relative file of the symbol, to disambiguate same-named symbols."
      },
      includeBody: {
        type: "boolean",
        description: "Include the symbol declaration body in the result."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      return asJsonOutput(await service.getSymbolDetails(args.namePath, { relativePath: args.relativePath, includeBody: args.includeBody }, undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "get_diagnostics",
    description: "Get language-server diagnostics (errors, warnings) for a file, or every diagnostic of the project when no file is given.",
    parameters: {
      relativePath: {
        type: "string",
        description: "Project-relative path of the file; omit for all files with diagnostics."
      }
    },
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(args, exec) {
      return asJsonOutput(await service.getDiagnostics(args.relativePath, undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "get_project_blueprint",
    description: "Get the blueprint of the project: every module with its symbol inventory and exports, file-to-file dependency edges, external package dependencies, and derived entry points. Derived from the persisted code graph (built at startup).",
    parameters: {},
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(_args, exec) {
      return asJsonOutput(await service.getBlueprint(undefined, exec.agent, exec.signal));
    }
  }));
  ctx.tools.register(defineTool({
    name: "refresh_code_index",
    description: "Force a full re-index of the project code graph (scan files, harvest symbols, rebuild the persisted blueprint). Only needed after large outside changes; the graph refreshes itself per session.",
    parameters: {},
    output: {
      schema: { type: "json" },
      render: jsonRender
    },
    async execute(_args, exec) {
      return asJsonOutput(await service.refresh(undefined, exec.agent, exec.signal));
    }
  }));
}

// src/index.ts
var name = "code-intel";
var inject = ["tools"];
function apply(ctx, config = {}) {
  const service = new CodeIntelService(ctx, config);
  registerCodeIntelTools(ctx, service);
  ctx.effect(() => () => {
    service.dispose();
  }, "code-intel: stop language servers");
}
export {
  CodeIntelService,
  apply,
  inject,
  name
};
