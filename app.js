(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":3,"ieee754":4,"isarray":5}],3:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],7:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],8:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],9:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],10:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":11}],11:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
},{"./_stream_readable":13,"./_stream_writable":15,"core-util-is":18,"inherits":7,"process-nextick-args":20}],12:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":14,"core-util-is":18,"inherits":7}],13:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var StringDecoder;

util.inherits(Readable, Stream);

function prependListener(emitter, event, fn) {
  if (typeof emitter.prependListener === 'function') {
    return emitter.prependListener(event, fn);
  } else {
    // This is a hack to make sure that our error handler is attached before any
    // userland ones.  NEVER DO THIS. This is here only because this code needs
    // to continue to work with older versions of Node.js that do not include
    // the prependListener() method. The goal is to eventually remove this hack.
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  }
}

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function') this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = bufferShim.from(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var _e = new Error('stream.unshift() after end event');
      stream.emit('error', _e);
    } else {
      var skipAdd;
      if (state.decoder && !addToFront && !encoding) {
        chunk = state.decoder.write(chunk);
        skipAdd = !state.objectMode && chunk.length === 0;
      }

      if (!addToFront) state.reading = false;

      // Don't add to the buffer if we've decoded to an empty string chunk and
      // we're not in object mode
      if (!skipAdd) {
        // if we want the data now, just emit it.
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          // update the buffer info.
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

          if (state.needReadable) emitReadable(stream);
        }
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var _i = 0; _i < len; _i++) {
      dests[_i].emit('unpipe', this);
    }return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1) return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function (ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = bufferShim.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'))

},{"./_stream_duplex":11,"./internal/streams/BufferList":16,"_process":9,"buffer":2,"buffer-shims":17,"core-util-is":18,"events":6,"inherits":7,"isarray":19,"process-nextick-args":20,"string_decoder/":27,"util":1}],14:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er) {
      done(stream, er);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('Not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

function done(stream, er) {
  if (er) return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":11,"core-util-is":18,"inherits":7}],15:[function(require,module,exports){
(function (process){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
  } catch (_) {}
})();

var Duplex;
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;
  // Always throw error if a null is written
  // if we are not in object mode then throw
  // if it is not a buffer, string, or undefined.
  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = bufferShim.from(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) processNextTick(cb, er);else cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
        afterWrite(stream, state, finished, cb);
      }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    while (entry) {
      buffer[count] = entry;
      entry = entry.next;
      count += 1;
    }

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;

  this.finish = function (err) {
    var entry = _this.entry;
    _this.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    if (state.corkedRequestsFree) {
      state.corkedRequestsFree.next = _this;
    } else {
      state.corkedRequestsFree = _this;
    }
  };
}
}).call(this,require('_process'))

},{"./_stream_duplex":11,"_process":9,"buffer":2,"buffer-shims":17,"core-util-is":18,"events":6,"inherits":7,"process-nextick-args":20,"util-deprecate":21}],16:[function(require,module,exports){
'use strict';

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

module.exports = BufferList;

function BufferList() {
  this.head = null;
  this.tail = null;
  this.length = 0;
}

BufferList.prototype.push = function (v) {
  var entry = { data: v, next: null };
  if (this.length > 0) this.tail.next = entry;else this.head = entry;
  this.tail = entry;
  ++this.length;
};

BufferList.prototype.unshift = function (v) {
  var entry = { data: v, next: this.head };
  if (this.length === 0) this.tail = entry;
  this.head = entry;
  ++this.length;
};

BufferList.prototype.shift = function () {
  if (this.length === 0) return;
  var ret = this.head.data;
  if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
  --this.length;
  return ret;
};

BufferList.prototype.clear = function () {
  this.head = this.tail = null;
  this.length = 0;
};

BufferList.prototype.join = function (s) {
  if (this.length === 0) return '';
  var p = this.head;
  var ret = '' + p.data;
  while (p = p.next) {
    ret += s + p.data;
  }return ret;
};

BufferList.prototype.concat = function (n) {
  if (this.length === 0) return bufferShim.alloc(0);
  if (this.length === 1) return this.head.data;
  var ret = bufferShim.allocUnsafe(n >>> 0);
  var p = this.head;
  var i = 0;
  while (p) {
    p.data.copy(ret, i);
    i += p.data.length;
    p = p.next;
  }
  return ret;
};
},{"buffer":2,"buffer-shims":17}],17:[function(require,module,exports){
(function (global){
'use strict';

var buffer = require('buffer');
var Buffer = buffer.Buffer;
var SlowBuffer = buffer.SlowBuffer;
var MAX_LEN = buffer.kMaxLength || 2147483647;
exports.alloc = function alloc(size, fill, encoding) {
  if (typeof Buffer.alloc === 'function') {
    return Buffer.alloc(size, fill, encoding);
  }
  if (typeof encoding === 'number') {
    throw new TypeError('encoding must not be number');
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  var enc = encoding;
  var _fill = fill;
  if (_fill === undefined) {
    enc = undefined;
    _fill = 0;
  }
  var buf = new Buffer(size);
  if (typeof _fill === 'string') {
    var fillBuf = new Buffer(_fill, enc);
    var flen = fillBuf.length;
    var i = -1;
    while (++i < size) {
      buf[i] = fillBuf[i % flen];
    }
  } else {
    buf.fill(_fill);
  }
  return buf;
}
exports.allocUnsafe = function allocUnsafe(size) {
  if (typeof Buffer.allocUnsafe === 'function') {
    return Buffer.allocUnsafe(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new Buffer(size);
}
exports.from = function from(value, encodingOrOffset, length) {
  if (typeof Buffer.from === 'function' && (!global.Uint8Array || Uint8Array.from !== Buffer.from)) {
    return Buffer.from(value, encodingOrOffset, length);
  }
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof value === 'string') {
    return new Buffer(value, encodingOrOffset);
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    var offset = encodingOrOffset;
    if (arguments.length === 1) {
      return new Buffer(value);
    }
    if (typeof offset === 'undefined') {
      offset = 0;
    }
    var len = length;
    if (typeof len === 'undefined') {
      len = value.byteLength - offset;
    }
    if (offset >= value.byteLength) {
      throw new RangeError('\'offset\' is out of bounds');
    }
    if (len > value.byteLength - offset) {
      throw new RangeError('\'length\' is out of bounds');
    }
    return new Buffer(value.slice(offset, offset + len));
  }
  if (Buffer.isBuffer(value)) {
    var out = new Buffer(value.length);
    value.copy(out, 0, 0, value.length);
    return out;
  }
  if (value) {
    if (Array.isArray(value) || (typeof ArrayBuffer !== 'undefined' && value.buffer instanceof ArrayBuffer) || 'length' in value) {
      return new Buffer(value);
    }
    if (value.type === 'Buffer' && Array.isArray(value.data)) {
      return new Buffer(value.data);
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ' + 'ArrayBuffer, Array, or array-like object.');
}
exports.allocUnsafeSlow = function allocUnsafeSlow(size) {
  if (typeof Buffer.allocUnsafeSlow === 'function') {
    return Buffer.allocUnsafeSlow(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size >= MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new SlowBuffer(size);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"buffer":2}],18:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../../../insert-module-globals/node_modules/is-buffer/index.js")})

},{"../../../../insert-module-globals/node_modules/is-buffer/index.js":8}],19:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],20:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}

}).call(this,require('_process'))

},{"_process":9}],21:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],22:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":12}],23:[function(require,module,exports){
(function (process){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

if (!process.browser && process.env.READABLE_STREAM === 'disable' && Stream) {
  module.exports = Stream;
}

}).call(this,require('_process'))

},{"./lib/_stream_duplex.js":11,"./lib/_stream_passthrough.js":12,"./lib/_stream_readable.js":13,"./lib/_stream_transform.js":14,"./lib/_stream_writable.js":15,"_process":9}],24:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":14}],25:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":15}],26:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":6,"inherits":7,"readable-stream/duplex.js":10,"readable-stream/passthrough.js":22,"readable-stream/readable.js":23,"readable-stream/transform.js":24,"readable-stream/writable.js":25}],27:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":2}],28:[function(require,module,exports){
arguments[4][7][0].apply(exports,arguments)
},{"dup":7}],29:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],30:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":29,"_process":9,"inherits":28}],31:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AjaxLoader = function () {
	function AjaxLoader() {
		_classCallCheck(this, AjaxLoader);
	}

	_createClass(AjaxLoader, [{
		key: "load",
		value: function load(filename) {
			return $.get(filename).then(function (csv) {
				return csv;
			}, function () {
				return new Error("Не удалось загрузить " + filename);
			});
		}
	}]);

	return AjaxLoader;
}();

module.exports = AjaxLoader;

},{}],32:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FileLoader = function () {
	function FileLoader() {
		_classCallCheck(this, FileLoader);
	}

	_createClass(FileLoader, [{
		key: "load",
		value: function load(file) {
			var d = $.Deferred();
			try {
				var reader = new window.FileReader();
				reader.onload = function (e) {
					d.resolve(e.target.result);
				};
				reader.onerror = function (err) {
					var message = "Не удалось загрузить файл";
					if (err !== undefined) message += ": " + err;
					d.reject(new Error(message));
				};
				reader.readAsText(file);
			} catch (ex) {
				d.reject(ex);
			}
			return d;
		}
	}]);

	return FileLoader;
}();

module.exports = FileLoader;

},{}],33:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LoadController = function () {
	function LoadController(model) {
		_classCallCheck(this, LoadController);

		this._model = model;

		this.participantsRegistryUrl = "data/ЕГРП.csv";
		this.ownersRegistryUrl = "data/Собственники.csv";
		this.incorrectApartmentsUrl = "data/Некорректные записи-дубликаты.csv";
		this.apartmentsWithoutSectionUrl = "data/Квартиры без номера секции.csv";
		this.oldApartmentNumbersUrl = "data/Старые номера квартир.csv";
		this.juridicalPersonsUrl = "data/Юридические лица.csv";

		this._participantsRegistry = null;
		this._ownersRegistry = null;
		this._apartmentsWithoutSection = null;
		this._incorrectApartments = null;
		this._oldApartmentNumbers = null;
		this._juridicalPersons = null;

		this._ajaxLoader = new AjaxLoader();
		this._fileLoader = new FileLoader();

		this._opCounter = 0;
		this.onOperationStart = new utils.Delegate();
		this.onOperationEnd = new utils.Delegate();
	}

	// load default data


	_createClass(LoadController, [{
		key: "init",
		value: function init() /* -> Deferred */{
			var me = this;
			return me._operation(function () {
				return $.Deferred().resolve().then(function () {
					return me.loadDefaultParticipantsRegistry();
				}).then(function () {
					return me.loadDefaultOwnersRegistry();
				}).then(function () {
					return me.loadDefaultApartmentsWithoutSection();
				}).then(function () {
					return me.loadDefaultIncorrectApartments();
				}).then(function () {
					return me.loadDefaultOldApartmentNumbers();
				}).then(function () {
					return me.loadDefaultJuridicalPersons();
				}).then(function () {
					return me.updateModel();
				});
			});
		}
	}, {
		key: "loadDefaultParticipantsRegistry",
		value: function loadDefaultParticipantsRegistry() /* -> Deferred */{
			var _this = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this.participantsRegistryUrl).then(function (csv) {
					me._participantsRegistry = csv;
				});
			});
		}
	}, {
		key: "loadDefaultOwnersRegistry",
		value: function loadDefaultOwnersRegistry() /* -> Deferred */{
			var _this2 = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this2.ownersRegistryUrl).then(function (csv) {
					me._ownersRegistry = csv;
				});
			});
		}
	}, {
		key: "loadDefaultApartmentsWithoutSection",
		value: function loadDefaultApartmentsWithoutSection() /* -> Deferred */{
			var _this3 = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this3.apartmentsWithoutSectionUrl).then(function (csv) {
					me._apartmentsWithoutSection = csv;
				});
			});
		}
	}, {
		key: "loadDefaultIncorrectApartments",
		value: function loadDefaultIncorrectApartments() /* -> Deferred */{
			var _this4 = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this4.incorrectApartmentsUrl).then(function (csv) {
					me._incorrectApartments = csv;
				});
			});
		}
	}, {
		key: "loadDefaultOldApartmentNumbers",
		value: function loadDefaultOldApartmentNumbers() /* -> Deferred */{
			var _this5 = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this5.oldApartmentNumbersUrl).then(function (csv) {
					me._oldApartmentNumbers = csv;
				});
			});
		}
	}, {
		key: "loadDefaultJuridicalPersons",
		value: function loadDefaultJuridicalPersons() /* -> Deferred */{
			var _this6 = this;

			var me = this;
			return me._operation(function () {
				return me._ajaxLoader.load(_this6.juridicalPersonsUrl).then(function (csv) {
					me._juridicalPersons = csv;
				});
			});
		}
	}, {
		key: "loadApartmentsWithoutSection",
		value: function loadApartmentsWithoutSection(file) /* -> Deferred */{
			var me = this;
			return me._operation(function () {
				return me._fileLoader.load(file).then(function (csv) {
					me._apartmentsWithoutSection = csv;
				});
			});
		}
	}, {
		key: "loadIncorrectApartments",
		value: function loadIncorrectApartments(file) /* -> Deferred */{
			var me = this;
			return me._operation(function () {
				return me._fileLoader.load(file).then(function (csv) {
					me._incorrectApartments = csv;
				});
			});
		}
	}, {
		key: "loadOldApartmentNumbers",
		value: function loadOldApartmentNumbers(file) /* -> Deferred */{
			var me = this;
			return me._operation(function () {
				return me._fileLoader.load(file).then(function (csv) {
					me._oldApartmentNumbers = csv;
				});
			});
		}
	}, {
		key: "loadJuridicalPersons",
		value: function loadJuridicalPersons(file) /* -> Deferred */{
			var me = this;
			return me._operation(function () {
				return me._fileLoader.load(file).then(function (csv) {
					me._juridicalPersons = csv;
				});
			});
		}
	}, {
		key: "updateModel",
		value: function updateModel() /* -> Deferred */{
			var me = this;
			var model = new Model();

			return me._operation(function () {
				return $.Deferred().resolve().then(function () {
					return read("данные из ЕГРП", me._participantsRegistry, new ParticipantsRegistryReader(model));
				}).then(function () {
					return read("данные из реестра собственникам долей", me._ownersRegistry, new OwnersRegistryReader(model));
				}).then(function () {
					return read("данные по квартирам без номера секции", me._apartmentsWithoutSection, new ApartmentsWithoutSectionReader(model));
				}).then(function () {
					return read("данные по некорректным записям-дубликатам", me._incorrectApartments, new IncorrectApartmentsReader(model));
				}).then(function () {
					return read("данные по старым номерам квартир", me._oldApartmentNumbers, new OldApartmentNumbersReader(model));
				}).then(function () {
					return read("данные по юридическим лицам", me._juridicalPersons, new JuridicalPersonsReader(model));
				}).then(function () {
					try {
						model.finish();
					} catch (ex) {
						return $.Deferred().reject(ex);
					}
					me._model.swap(model);
					me._model.changed();
				});
			});
		}
	}, {
		key: "_operation",
		value: function _operation(f) {
			var me = this;
			me._operationStart();
			return f().done(function () {
				me._operationEnd();
			}).fail(function (ex) {
				me._operationEnd(ex);
			});
		}
	}, {
		key: "_operationStart",
		value: function _operationStart() {
			if (this._opCounter++ == 0) this.onOperationStart.trigger();
		}
	}, {
		key: "_operationEnd",
		value: function _operationEnd(ex) {
			this._opCounter = Math.max(1, this._opCounter);
			if (--this._opCounter == 0) this.onOperationEnd.trigger(ex);
		}
	}]);

	return LoadController;
}();

module.exports = LoadController;

var utils = require("app/utils");
var AjaxLoader = require("app/AjaxLoader");
var FileLoader = require("app/FileLoader");
var Model = require("app/model/Model");
var ParticipantsRegistryReader = require("app/model/readers/ParticipantsRegistryReader");
var OwnersRegistryReader = require("app/model/readers/OwnersRegistryReader");
var ApartmentsWithoutSectionReader = require("app/model/readers/ApartmentsWithoutSectionReader");
var IncorrectApartmentsReader = require("app/model/readers/IncorrectApartmentsReader");
var OldApartmentNumbersReader = require("app/model/readers/OldApartmentNumbersReader");
var JuridicalPersonsReader = require("app/model/readers/JuridicalPersonsReader");

function read(dataDescription, data, reader) /* -> Deferred */{
	var d = $.Deferred();
	if (!data) return d.reject(new Error("Отсутствуют " + dataDescription));
	reader.read(data, function (ex) {
		ex ? d.reject(ex) : d.resolve();
	});
	return d;
}

},{"app/AjaxLoader":31,"app/FileLoader":32,"app/model/Model":37,"app/model/readers/ApartmentsWithoutSectionReader":42,"app/model/readers/IncorrectApartmentsReader":44,"app/model/readers/JuridicalPersonsReader":45,"app/model/readers/OldApartmentNumbersReader":46,"app/model/readers/OwnersRegistryReader":47,"app/model/readers/ParticipantsRegistryReader":49,"app/utils":51}],34:[function(require,module,exports){
"use strict";

var Unknown = "???";
var Cross = "✕";

function formatDate(date) {
	var day = ("0" + date.getDate()).slice(-2);
	var month = ("0" + (date.getMonth() + 1)).slice(-2);
	var year = date.getFullYear();
	return day + "." + month + "." + year;
}

module.exports = {
	Unknown: Unknown,
	Cross: Cross,
	formatDate: formatDate
};

},{}],35:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CsvError = function (_Error) {
	_inherits(CsvError, _Error);

	function CsvError(line, innerError) {
		_classCallCheck(this, CsvError);

		var _this = _possibleConstructorReturn(this, (CsvError.__proto__ || Object.getPrototypeOf(CsvError)).call(this, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 " + line + ": " + innerError.message));

		_this.line = line;
		_this.innerError = innerError;
		return _this;
	}

	return CsvError;
}(Error);

module.exports = CsvError;

var utils = require("app/utils");

},{"app/utils":51}],36:[function(require,module,exports){
"use strict";

require("app/polyfills");

var MainView = require("app/views/MainView");
var IncompatibleBrowserView = require("app/views/IncompatibleBrowserView");
var Model = require("app/model/Model");
var LoadController = require("app/LoadController");

$(checkBrowser() ? main : incompatibleBrowser);

function checkBrowser() {
	// IE implementation of flexbox is unaccaptable because of numerous hard-to-fix bugs
	if (/MSIE/.test(navigator.userAgent) || /Trident/.test(navigator.userAgent)) return false;

	return Modernizr.flexwrap;
}

function main() {

	var model = new Model();
	var loadController = new LoadController(model);

	var mainView = new MainView(model, loadController);
	mainView.install($(document.body));

	loadController.init().then(function () {
		if (!mainView.getActiveTab()) mainView.setActiveTab(MainView.Tab.Grid);
	}, function () {
		if (!mainView.getActiveTab()) mainView.setActiveTab(MainView.Tab.Data);
	});
}

function incompatibleBrowser() {
	new IncompatibleBrowserView().install($(document.body));
}

},{"app/LoadController":33,"app/model/Model":37,"app/polyfills":50,"app/views/IncompatibleBrowserView":55,"app/views/MainView":56}],37:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Model = function () {
	function Model() {
		_classCallCheck(this, Model);

		this.records = [];
		this.objects = [];
		this._objectsById = {};
		this.sqlModel = new SqlModel();
		this.onChanged = new utils.Delegate();
	}

	_createClass(Model, [{
		key: "addRecord",
		value: function addRecord(record) {
			this.records.push(record);
		}
	}, {
		key: "addObject",
		value: function addObject(object) {
			this.objects.push(object);
		}

		// Modification operations
		// ====================================================

	}, {
		key: "removeObject",
		value: function removeObject(object) {
			utils.Arrays.removeFirst(this.objects, object);
		}

		// ====================================================

	}, {
		key: "finish",
		value: function finish() {
			// 1. assign ids
			// 2. fill array of objects in each record
			for (var i = 0, c = this.records.length; i < c; i++) {
				var record = this.records[i];
				record.id = i + 1;
				record.objects = [];
			}
			this._objectsById = {};
			for (var i = 0, c = this.objects.length; i < c; i++) {
				var obj = this.objects[i];
				obj.id = i + 1;
				this._objectsById[obj.id] = obj;
				obj.record.objects.push(obj);
			}

			searchDuplicates(this.objects);

			this.sqlModel.init(this);
		}
	}, {
		key: "swap",
		value: function swap(other) {
			var tmp;

			tmp = this.records;
			this.records = other.records;
			other.records = tmp;

			tmp = this.objects;
			this.objects = other.objects;
			other.objects = tmp;

			tmp = this._objectsById;
			this._objectsById = other._objectsById;
			other._objectsById = tmp;

			this.sqlModel.swap(other.sqlModel);
		}
	}, {
		key: "changed",
		value: function changed() {
			this.onChanged.trigger();
		}

		// Query operations
		// ====================================================

	}, {
		key: "getObjectById",
		value: function getObjectById(objectId) {
			return this._objectsById[objectId];
		}
	}]);

	return Model;
}();

module.exports = Model;

var utils = require("app/utils");
var SqlModel = require("app/model/SqlModel");
var m = require("app/model/ModelClasses");

function searchDuplicates(objects) {
	var map = {};

	for (var i = 0, c = objects.length; i < c; i++) {
		var obj = objects[i];
		if (!(obj instanceof m.Apartment) || obj.section == null) continue;

		var dup = optionallyInsert(optionallyInsert(optionallyInsert(optionallyInsert(map, obj.building), obj.section), obj.floor), obj.number, obj);
		if (dup !== obj) {
			dup.duplicate = true;
			obj.duplicate = true;
		}
	}
}

function optionallyInsert(map, key, value /* = {} */) {
	if (map.hasOwnProperty(key)) return map[key];
	if (value === undefined) value = {};
	map[key] = value;
	return value;
}

},{"app/model/ModelClasses":38,"app/model/SqlModel":41,"app/utils":51}],38:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Record = function Record() {
	_classCallCheck(this, Record);

	this.id = null; // assigned by Model
};

var ParticipantsRegistryRecord = function (_Record) {
	_inherits(ParticipantsRegistryRecord, _Record);

	function ParticipantsRegistryRecord(number, registryNumber, date, source) {
		_classCallCheck(this, ParticipantsRegistryRecord);

		var _this = _possibleConstructorReturn(this, (ParticipantsRegistryRecord.__proto__ || Object.getPrototypeOf(ParticipantsRegistryRecord)).call(this));

		_this.number = number;
		_this.registryNumber = registryNumber;
		_this.date = date;
		_this.owner = null;
		_this.source = source;
		return _this;
	}

	return ParticipantsRegistryRecord;
}(Record);

ParticipantsRegistryRecord.prototype.type = "ЕГРП";

var OwnersRegistryRecord = function (_Record2) {
	_inherits(OwnersRegistryRecord, _Record2);

	function OwnersRegistryRecord(number, owner) {
		_classCallCheck(this, OwnersRegistryRecord);

		var _this2 = _possibleConstructorReturn(this, (OwnersRegistryRecord.__proto__ || Object.getPrototypeOf(OwnersRegistryRecord)).call(this));

		_this2.number = number;
		_this2.owner = owner;
		return _this2;
	}

	return OwnersRegistryRecord;
}(Record);

OwnersRegistryRecord.prototype.type = "Реестр собственников долей";

var Obj = function Obj(record) {
	_classCallCheck(this, Obj);

	this.id = null; // assigned by Model
	this.record = record;
};

var ParkingPlace = function (_Obj) {
	_inherits(ParkingPlace, _Obj);

	function ParkingPlace(record, number, building, area) {
		_classCallCheck(this, ParkingPlace);

		var _this3 = _possibleConstructorReturn(this, (ParkingPlace.__proto__ || Object.getPrototypeOf(ParkingPlace)).call(this, record));

		_this3.number = number;
		_this3.building = building;
		_this3.area = area;
		return _this3;
	}

	return ParkingPlace;
}(Obj);

var Apartment = function (_Obj2) {
	_inherits(Apartment, _Obj2);

	function Apartment(record, type, number, building, floor, landingNumber, section, area) {
		_classCallCheck(this, Apartment);

		var _this4 = _possibleConstructorReturn(this, (Apartment.__proto__ || Object.getPrototypeOf(Apartment)).call(this, record));

		_this4.type = type;
		_this4.number = number;
		_this4.originalNumber = null;
		_this4.building = building;
		_this4.floor = floor;
		_this4.landingNumber = landingNumber;
		_this4.section = section;
		_this4.area = area;
		_this4.duplicate = false; // assigned by Model
		return _this4;
	}

	_createClass(Apartment, [{
		key: "setNumber",
		value: function setNumber(number) {
			if (this.originalNumber != null) throw new Error("Исходный номер квартиры уже задан: " + this.originalNumber);
			this.originalNumber = this.number;
			this.number = number;
		}
	}]);

	return Apartment;
}(Obj);

var NonResidentialPremise = function (_Obj3) {
	_inherits(NonResidentialPremise, _Obj3);

	function NonResidentialPremise(record, type, number, building, section, area) {
		_classCallCheck(this, NonResidentialPremise);

		var _this5 = _possibleConstructorReturn(this, (NonResidentialPremise.__proto__ || Object.getPrototypeOf(NonResidentialPremise)).call(this, record));

		_this5.type = type;
		_this5.number = number;
		_this5.building = building;
		_this5.section = section;
		_this5.area = area;
		return _this5;
	}

	return NonResidentialPremise;
}(Obj);

module.exports = {
	Record: Record, ParticipantsRegistryRecord: ParticipantsRegistryRecord, OwnersRegistryRecord: OwnersRegistryRecord,
	Obj: Obj, ParkingPlace: ParkingPlace, Apartment: Apartment, NonResidentialPremise: NonResidentialPremise
};

},{}],39:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var RecordSelectionModel = function () {
	function RecordSelectionModel() {
		_classCallCheck(this, RecordSelectionModel);

		this._record = null;
		this.onChanged = new utils.Delegate();
	}

	_createClass(RecordSelectionModel, [{
		key: "setRecord",
		value: function setRecord( /* optional */record) {
			if (record == this._record) return;
			this._record = record;
			this.onChanged.trigger();
		}
	}, {
		key: "clear",
		value: function clear() {
			this.setRecord(null);
		}
	}, {
		key: "getRecord",
		value: function getRecord() {
			return this._record;
		}
	}]);

	return RecordSelectionModel;
}();

module.exports = RecordSelectionModel;

var utils = require("app/utils");

},{"app/utils":51}],40:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SearchModel = function () {
	function SearchModel() {
		_classCallCheck(this, SearchModel);

		this._ids = [];
		this.onChanged = new utils.Delegate();
	}

	_createClass(SearchModel, [{
		key: "setObjectIds",
		value: function setObjectIds(value) {
			if (this._ids.length == 0 && value.length == 0) {
				// omit onChanged in this common case
				return;
			}
			this._ids = value;
			this.onChanged.trigger();
		}
	}, {
		key: "getObjectIds",
		value: function getObjectIds() {
			return this._ids;
		}
	}]);

	return SearchModel;
}();

module.exports = SearchModel;

var utils = require("app/utils");

},{"app/utils":51}],41:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Schema = "\ncreate table Record (\n\tid int not null primary key,\n\ttype text not null,\n\tnumber int not null,\n\tregistryNumber text,\n\t[date] date,\n\towner text,\n\tsource text\n);\n\ncreate table ParkingPlace (\n\tid int not null primary key,\n\trecordId int not null references Record(id),\n\tnumber int not null,\n\tbuilding int not null,\n\tarea number not null\n);\n\ncreate table Apartment (\n\tid int not null primary key,\n\trecordId int not null references Record(id),\n\ttype text not null,\n\tnumber int not null,\n\toriginalNumber int,\n\tbuilding int not null,\n\tfloor int not null,\n\tlandingNumber int,\n\tsection int null,\n\tarea number not null,\n\tduplicate bool not null\n);\n\n/* Non-Residential Premise */\ncreate table NRPremise (\n\tid int not null primary key,\n\trecordId int not null references Record(id),\n\ttype text not null,\n\tnumber int null,\n\tbuilding int not null,\n\tsection int null,\n\tarea number not null\n);\n".trim();

var SqlModel = function () {
	function SqlModel() {
		_classCallCheck(this, SqlModel);

		globalInit();
		this.db = new alasql.Database();
		initDb(this.db);
	}

	_createClass(SqlModel, [{
		key: "init",
		value: function init(model) {
			var db = new alasql.Database();
			initDb(db);
			loadModel(db, model);
			this.db = db;
		}
	}, {
		key: "query",
		value: function query(sql) /* -> [][][] */{
			var res = this.db.exec(sql);
			if (res.length > 0 && res[0].length > 0 && $.isArray(res[0][0])) {
				// alasql returned multiple datasets
				return res;
			} else {
				// alasql returned single dataset
				return [res];
			}
		}
	}, {
		key: "swap",
		value: function swap(other) {
			var tmp = this.db;
			this.db = other.db;
			other.db = tmp;
		}
	}]);

	return SqlModel;
}();

SqlModel.Schema = Schema;

module.exports = SqlModel;

var m = require("app/model/ModelClasses");

function globalInit() {
	alasql.options.casesensitive = "false";
	// return rows as arrays, not objects
	alasql.options.modifier = "MATRIX";
}

function initDb(db) {
	db.exec(Schema);
}

function loadModel(db, model) {

	for (var i = 0, c = model.objects.length; i < c; i++) {
		var obj = model.objects[i];
		obj.recordId = obj.record.id;
	}

	var Record = model.records;

	var ParkingPlace = model.objects.filter(function (obj) {
		return obj instanceof m.ParkingPlace;
	});
	var Apartment = model.objects.filter(function (obj) {
		return obj instanceof m.Apartment;
	});
	var NRPremise = model.objects.filter(function (obj) {
		return obj instanceof m.NonResidentialPremise;
	});

	db.exec("\n\t\tINSERT INTO Record(id, type, number, registryNumber, [date], owner, source)\n\t\tSELECT id, type, number, registryNumber, [date], owner, source\n\t\tFROM ?;\n\n\t\tINSERT INTO ParkingPlace(id, recordId, number, building, area)\n\t\tSELECT id, recordId, number, building, area\n\t\tFROM ?;\n\n\t\tINSERT INTO Apartment(id, recordId, type, number, originalNumber, building, floor, landingNumber, section, area, duplicate)\n\t\tSELECT id, recordId, type, number, originalNumber, building, floor, landingNumber, section, area, duplicate\n\t\tFROM ?;\n\n\t\tINSERT INTO NRPremise(id, recordId, type, number, building, section, area)\n\t\tSELECT id, recordId, type, number, building, section, area\n\t\tFROM ?;\n\t", [Record, ParkingPlace, Apartment, NRPremise]);
}

},{"app/model/ModelClasses":38}],42:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var ApartmentsWithoutSectionReader = function (_BaseCsvReader) {
	_inherits(ApartmentsWithoutSectionReader, _BaseCsvReader);

	function ApartmentsWithoutSectionReader(model) {
		_classCallCheck(this, ApartmentsWithoutSectionReader);

		var _this = _possibleConstructorReturn(this, (ApartmentsWithoutSectionReader.__proto__ || Object.getPrototypeOf(ApartmentsWithoutSectionReader)).call(this, {
			skipRows: 1
		}));

		_this._model = model;
		return _this;
	}
	// @override


	_createClass(ApartmentsWithoutSectionReader, [{
		key: "_processRecord",
		value: function _processRecord(record) {

			var section = Parsing.parseSection(record[0]);
			var floor = Parsing.parseFloor(record[1]);
			var number = Parsing.parseNumber(record[2]);
			var recordNumber = Parsing.parseRecordNumber(record[3]);

			var objects = this._model.objects;
			var foundObject = null;
			for (var i = 0, c = objects.length; i < c; i++) {
				var obj = objects[i];
				if (obj instanceof m.Apartment && obj.floor == floor && obj.number == number && obj.section == null && obj.record.number == recordNumber) {

					var _record = obj.record;
					if (!(_record instanceof m.ParticipantsRegistryRecord)) throw new Error("Найденная запись имеет некорректный тип: " + _record.type);

					if (foundObject != null) throw new Error("Найдено несколько подходящих записей; должна быть одна");
					foundObject = obj;
				}
			}
			if (!foundObject) throw new Error("Запись не найдена");
			foundObject.section = section;
		}
	}]);

	return ApartmentsWithoutSectionReader;
}(BaseCsvReader);

module.exports = ApartmentsWithoutSectionReader;

var m = require("app/model/ModelClasses");
var Parsing = require("app/model/readers/Parsing");

},{"app/model/ModelClasses":38,"app/model/readers/BaseCsvReader":43,"app/model/readers/Parsing":48}],43:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseCsvReader = function () {
	// config: {
	//   skipRows /* = 0 */
	// }
	function BaseCsvReader(config) {
		_classCallCheck(this, BaseCsvReader);

		this._config = config || {};
	}

	_createClass(BaseCsvReader, [{
		key: "read",
		value: function read(csv, callback) {
			var me = this;

			var readable = new stream.Readable();
			readable.push(csv);
			readable.push(null);

			var parser = parse({
				delimiter: "\t",
				relax_column_count: true
			});
			readable.pipe(parser);

			var skipRows = this._config.skipRows || 0;
			parser.on("readable", function () {
				var record;
				while (record = parser.read()) {
					if (skipRows > 0) {
						--skipRows;
						continue;
					}
					record = record.map(function (x) {
						return x.trim();
					});
					me._processRecord(record);
				}
			});
			parser.on("error", function (ex) {
				var err = new CsvError(parser.lines, ex);
				me._finish(err);
				callback(err);
			});
			parser.on("finish", function () {
				var err = null;
				me._finish(err);
				callback(err);
			});
		}
		// @abstract

	}, {
		key: "_processRecord",
		value: function _processRecord(record) {
			throw new Error("Not implemented");
		}
		// @virtual

	}, {
		key: "_finish",
		value: function _finish( /* optional */err) {}
	}]);

	return BaseCsvReader;
}();

module.exports = BaseCsvReader;

var parse = require("csv-parse");
var stream = require("stream");
var CsvError = require("app/exceptions/CsvError");

},{"app/exceptions/CsvError":35,"csv-parse":64,"stream":26}],44:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var IncorrectApartmentsReader = function (_BaseCsvReader) {
	_inherits(IncorrectApartmentsReader, _BaseCsvReader);

	function IncorrectApartmentsReader(model) {
		_classCallCheck(this, IncorrectApartmentsReader);

		var _this = _possibleConstructorReturn(this, (IncorrectApartmentsReader.__proto__ || Object.getPrototypeOf(IncorrectApartmentsReader)).call(this, {
			skipRows: 1
		}));

		_this._model = model;
		return _this;
	}
	// @override


	_createClass(IncorrectApartmentsReader, [{
		key: "_processRecord",
		value: function _processRecord(record) {

			var recordNumber = Parsing.parseRecordNumber(record[0]);
			var number = Parsing.parseNumber(record[1]);

			var objects = this._model.objects;
			var foundObject = null;
			for (var i = 0, c = objects.length; i < c; i++) {
				var obj = objects[i];
				if (obj instanceof m.Apartment && obj.record.number == recordNumber && obj.number == number) {

					if (foundObject != null) throw new Error("Найдено несколько подходящих записей; должна быть одна");
					foundObject = obj;
				}
			}
			if (!foundObject) throw new Error("Запись не найдена");
			this._model.removeObject(foundObject);
		}
	}]);

	return IncorrectApartmentsReader;
}(BaseCsvReader);

module.exports = IncorrectApartmentsReader;

var m = require("app/model/ModelClasses");
var Parsing = require("app/model/readers/Parsing");

},{"app/model/ModelClasses":38,"app/model/readers/BaseCsvReader":43,"app/model/readers/Parsing":48}],45:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var JuridicalPersonsReader = function (_BaseCsvReader) {
	_inherits(JuridicalPersonsReader, _BaseCsvReader);

	function JuridicalPersonsReader(model) {
		_classCallCheck(this, JuridicalPersonsReader);

		var _this = _possibleConstructorReturn(this, (JuridicalPersonsReader.__proto__ || Object.getPrototypeOf(JuridicalPersonsReader)).call(this, {
			skipRows: 1
		}));

		_this._model = model;
		_this._searchStrings = [];
		return _this;
	}
	// @override


	_createClass(JuridicalPersonsReader, [{
		key: "_processRecord",
		value: function _processRecord(record) {
			this._searchStrings.push(record[0].toLowerCase());
		}
	}, {
		key: "_finish",
		value: function _finish() {
			var records = this._model.records;
			for (var i = 0, c = records.length; i < c; i++) {
				var record = records[i];
				if (record instanceof m.ParticipantsRegistryRecord) extractOwner(record, this._searchStrings);
			}
		}
	}]);

	return JuridicalPersonsReader;
}(BaseCsvReader);

function extractOwner(record, juridicalPersonsSearchStrings) {
	var m = record.source.match(/Участники долевого\n(.*?)(\n|$)/i);
	if (!m) throw new Error("В записи не найдены данные об участниках долевого строительства");

	// set `record.owner` to the name of the physical person
	// for juridical persons `owner` remains `null`
	var owner = m[1].toLowerCase();
	if (!juridicalPersonsSearchStrings.some(function (searchString) {
		return owner.indexOf(searchString) >= 0;
	})) record.owner = owner;
}

module.exports = JuridicalPersonsReader;

var m = require("app/model/ModelClasses");

},{"app/model/ModelClasses":38,"app/model/readers/BaseCsvReader":43}],46:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var OldApartmentNumbersReader = function (_BaseCsvReader) {
	_inherits(OldApartmentNumbersReader, _BaseCsvReader);

	function OldApartmentNumbersReader(model) {
		_classCallCheck(this, OldApartmentNumbersReader);

		var _this = _possibleConstructorReturn(this, (OldApartmentNumbersReader.__proto__ || Object.getPrototypeOf(OldApartmentNumbersReader)).call(this, {
			skipRows: 1
		}));

		_this._model = model;
		return _this;
	}
	// @override


	_createClass(OldApartmentNumbersReader, [{
		key: "_processRecord",
		value: function _processRecord(record) {

			for (var i = 0, c = record.length; i < c; i++) {
				record[i] = utils.parseInt(record[i]);
				if (record[i] == null) throw new Error("Значения должны быть числовыми");
			}

			var sectionGe = record[0];
			var sectionLe = record[1];
			var floorGe = record[2];
			var floorLe = record[3];
			var numberGe = record[4];
			var numberLe = record[5];
			var d = record[6];

			var objects = this._model.objects;
			var updates = 0;
			for (var i = 0, c = objects.length; i < c; i++) {
				var obj = objects[i];
				if (obj instanceof m.Apartment && obj.section >= sectionGe && obj.section <= sectionLe && obj.floor >= floorGe && obj.floor <= floorLe && obj.number >= numberGe && obj.number <= numberLe) {
					obj.setNumber(obj.number + d);
					updates++;
				}
			}
			if (updates == 0) throw new Error("Не найдено ни одной подходящей записи");
		}
	}]);

	return OldApartmentNumbersReader;
}(BaseCsvReader);

module.exports = OldApartmentNumbersReader;

var utils = require("app/utils");
var m = require("app/model/ModelClasses");

},{"app/model/ModelClasses":38,"app/model/readers/BaseCsvReader":43,"app/utils":51}],47:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var OwnersRegistryReader = function (_BaseCsvReader) {
	_inherits(OwnersRegistryReader, _BaseCsvReader);

	function OwnersRegistryReader(model) {
		_classCallCheck(this, OwnersRegistryReader);

		var _this = _possibleConstructorReturn(this, (OwnersRegistryReader.__proto__ || Object.getPrototypeOf(OwnersRegistryReader)).call(this, {
			skipRows: 2
		}));

		_this._model = model;
		return _this;
	}
	// @override


	_createClass(OwnersRegistryReader, [{
		key: "_processRecord",
		value: function _processRecord(record) {

			var recordNumber = record[0];
			if (!recordNumber)
				// не обрабатываем строки без номера записи
				return;
			recordNumber = Parsing.parseRecordNumber(recordNumber);

			var number = Parsing.parseNumber(record[1]);
			var landingNumber = Parsing.parseLandingNumber(record[2]);
			var floor = Parsing.parseFloor(record[3]);
			var building = Parsing.parseBuilding(record[4]);
			var section = Parsing.parseSection(record[5]);
			var area = Parsing.parseArea(record[6]);

			var owner = record[7];
			if (!owner) throw new Error("Отсутствует владелец: " + record[7]);

			var modelRecord = new m.OwnersRegistryRecord(recordNumber, owner);
			this._model.addRecord(modelRecord);

			var type = "квартира";
			this._model.addObject(new m.Apartment(modelRecord, type, number, building, floor, landingNumber, section, area));
		}
	}]);

	return OwnersRegistryReader;
}(BaseCsvReader);

module.exports = OwnersRegistryReader;

var m = require("app/model/ModelClasses.js");
var Parsing = require("app/model/readers/Parsing.js");

},{"app/model/ModelClasses.js":38,"app/model/readers/BaseCsvReader":43,"app/model/readers/Parsing.js":48}],48:[function(require,module,exports){
"use strict";

module.exports = {
	parseCsvFloat: parseCsvFloat,
	parseSection: parseSection, parseFloor: parseFloor, parseBuilding: parseBuilding, parseNumber: parseNumber, parseLandingNumber: parseLandingNumber, parseRecordNumber: parseRecordNumber, parseArea: parseArea
};

var utils = require("app/utils");

function parseCsvFloat(value) {
	value = value.replace(/,/g, ".");
	return utils.parseFloat(value);
}

// ========================================================

function parseSection(s) {
	var value = utils.parseInt(s);
	if (value == null) throw new Error("Некорректный номер секции: " + s);
	return value;
}

function parseFloor(s) {
	var value = utils.parseInt(s);
	if (value == null) throw new Error("Некорректный номер этажа: " + s);
	return value;
}

function parseBuilding(s) {
	var value = utils.parseInt(s);
	if (value != 1 && value != 2) throw new Error("Некорректный номер корпуса: " + s);
	return value;
}

function parseNumber(s) {
	var value = utils.parseInt(s);
	if (value == null) throw new Error("Некорректный номер квартиры: " + s);
	return value;
}

function parseLandingNumber(s) {
	var value = utils.parseInt(s);
	if (value == null) throw new Error("Некорректный номер на площадке: " + s);
	return value;
}

function parseRecordNumber(s) {
	var value = utils.parseInt(s);
	if (value == null) throw new Error("Некорректный номер записи: " + s);
	return value;
}

function parseArea(s) {
	var value = parseCsvFloat(s);
	if (value == null) throw new Error("Некорректное значение площади: " + s);
	return value;
}

},{"app/utils":51}],49:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseCsvReader = require("app/model/readers/BaseCsvReader");

var ParticipantsRegistryReader = function (_BaseCsvReader) {
	_inherits(ParticipantsRegistryReader, _BaseCsvReader);

	function ParticipantsRegistryReader(model) {
		_classCallCheck(this, ParticipantsRegistryReader);

		var _this = _possibleConstructorReturn(this, (ParticipantsRegistryReader.__proto__ || Object.getPrototypeOf(ParticipantsRegistryReader)).call(this, {
			skipRows: 1
		}));

		_this._model = model;
		_this._records = {}; // recordNumber => _Record
		return _this;
	}

	_createClass(ParticipantsRegistryReader, [{
		key: "read",
		value: function read(csv, callback) {
			var me = this;
			_get(ParticipantsRegistryReader.prototype.__proto__ || Object.getPrototypeOf(ParticipantsRegistryReader.prototype), "read", this).call(this, csv, function (ex) {
				if (!ex) for (var key in me._records) {
					if (me._records.hasOwnProperty(key)) me._records[key].finish();
				}callback(ex);
			});
		}
		// @override

	}, {
		key: "_processRecord",
		value: function _processRecord(record) {
			var recordNumber = record[3];
			if (!recordNumber)
				// не обрабатываем строки без номера записи
				return;
			recordNumber = Parsing.parseRecordNumber(recordNumber);

			var source = record[1];
			if (!source) throw new Error("Отсутвует строка записи");
			var _record;
			var modelRecord;
			if (!(recordNumber in this._records)) {
				_record = this._records[recordNumber] = new _Record(recordNumber);
				modelRecord = _record.modelRecord();
				this._model.addRecord(modelRecord);
			} else {
				_record = this._records[recordNumber];
				modelRecord = _record.modelRecord();
			}
			_record.appendSource(source);

			var type = record[4];
			if (!type) {
				// строка без объекта
				for (var i = 5; i < record.length; i++) {
					if (record[i]) throw new Error("Строка, не содержащая тип объекта, не должна содержать информации об объекте");
				}return;
			}

			var number = record[5];
			// номер объекта опциональный для нежилых помещений
			number = !number || number == "бн" ? null : Parsing.parseNumber(number);

			var building = Parsing.parseBuilding(record[6]);
			var area = Parsing.parseArea(record[9]);

			if (type == "машиноместо") {
				if (number == null) throw new Error("Некорректный номер объекта: " + record[5]);
				this._model.addObject(new m.ParkingPlace(modelRecord, number, building, area));
				return;
			}

			var section = record[8];
			// номер секции опциональный
			section = !section || section == "нет" || section == "?" ? null : Parsing.parseSection(section);

			if (type == "неж пом" || type.search(/предприятие/i) >= 0 || type == "магазин" || type == "офис") {
				this._model.addObject(new m.NonResidentialPremise(modelRecord, type, number, building, section, area));
				return;
			}

			var floor = Parsing.parseFloor(record[7]);

			if (number == null) throw new Error("Некорректный номер объекта: " + record[5]);

			var landingNumber = null;
			this._model.addObject(new m.Apartment(modelRecord, type, number, building, floor, landingNumber, section, area));
		}
	}]);

	return ParticipantsRegistryReader;
}(BaseCsvReader);

module.exports = ParticipantsRegistryReader;

var utils = require("app/utils");
var m = require("app/model/ModelClasses.js");
var Parsing = require("app/model/readers/Parsing.js");

var _Record = function () {
	function _Record(recordNumber) {
		_classCallCheck(this, _Record);

		this._source = [];
		this._modelRecord = new m.ParticipantsRegistryRecord(recordNumber, null, null, null);
	}

	_createClass(_Record, [{
		key: "modelRecord",
		value: function modelRecord() {
			return this._modelRecord;
		}
	}, {
		key: "appendSource",
		value: function appendSource(source) {
			this._source.push(source);
		}
	}, {
		key: "finish",
		value: function finish() {
			var source = this._source.join("\n");
			var registryInfo = extractRegistryInfo(source);
			this._modelRecord.registryNumber = registryInfo.number;
			this._modelRecord.date = registryInfo.date;
			this._modelRecord.source = source;
		}
	}]);

	return _Record;
}();

function extractRegistryInfo(source) {
	var m = source.match(/№\s*(.*?)\s+от\s+(\d+)\.(\d+)\.(\d+)/);
	if (!m) throw new Error("В записи не найдены регистрационный номер и дата регистрации");

	var number = m[1];

	var day = utils.parseInt(m[2]);
	var month = utils.parseInt(m[3]);
	var year = utils.parseInt(m[4]);
	var date = new Date(year, month - 1, day);

	return { number: number, date: date };
}

},{"app/model/ModelClasses.js":38,"app/model/readers/BaseCsvReader":43,"app/model/readers/Parsing.js":48,"app/utils":51}],50:[function(require,module,exports){
"use strict";

require("function.name-polyfill");

if (!String.prototype.startsWith) {
	String.prototype.startsWith = function (other) {
		return this.substring(0, other.length) === other;
	};
	String.prototype.endsWith = function (other) {
		return this.substring(this.length - other.length) === other;
	};
}

},{"function.name-polyfill":65}],51:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ====================================================
// JS
// ====================================================

function parseInt(value) {
	value = window.parseInt(value, 10);
	return isNaN(value) ? null : value;
}

function parseFloat(value) {
	value = window.parseFloat(value);
	return isNaN(value) ? null : value;
}

function parseDate(value) {
	var date = new Date(value);
	return isNaN(date.getTime()) ? null : date;
}

// ====================================================
// Arrays
// ====================================================

var Arrays = {

	clone: function clone(a) {
		return a.slice(0);
	},

	findFirstIndex: function findFirstIndex(a, value) {
		return a.indexOf(value);
	},

	// remove first value === given
	removeFirst: function removeFirst(a, value) {
		var pos = this.findFirstIndex(a, value);
		if (pos >= 0) {
			a.splice(pos, 1);
			return true;
		}
		return false;
	}
};

// ====================================================
// Strings
// ====================================================

function cutString(s, maxLength, ellipsis /* = "..." */) {
	if (ellipsis === undefined) ellipsis = "...";
	return s.length <= maxLength ? s : s.substring(0, maxLength) + ellipsis;
}

// ====================================================
// HTML
// ====================================================

function htmlEncode(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====================================================
// DOM
// ====================================================

function createFromHtml(html) {
	var div = document.createElement("div");
	div.innerHTML = html;
	if (div.children.length != 1) throw new Error("Failed to create DOM element from HTML: " + cutString(html, 20));
	return div.firstElementChild;
}

// ====================================================
// L18N
// ====================================================

// http://translate.sourceforge.net/wiki/l10n/pluralforms
function plural(n, /* optional */a) {
	n = n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
	return a === undefined ? n : a[n];
}

// ====================================================
// Delegate
// ====================================================

var Delegate = function () {
	function Delegate() {
		_classCallCheck(this, Delegate);

		this.handlers = [];
		this._mute = 0;
	}

	_createClass(Delegate, [{
		key: 'bind',
		value: function bind(handler, /* optional */context) {
			if (handler == null) throw new Error("Argument is null: handler");
			this.handlers.push({ handler: handler, context: context });
		}
	}, {
		key: 'unbind',
		value: function unbind(handler, /* optional */context) {
			if (handler == null) throw new Error("Argument is null: handler");
			var len = this.handlers.length;
			this.handlers = this.handlers.filter(function (h) {
				return !(h.handler === handler && (context === undefined || h.context === context));
			});
			if (this.handlers.length == len) throw new Error("Handler to unbind was not found");
		}
	}, {
		key: 'trigger',
		value: function trigger( /* optional */data) {
			if (this._mute > 0) return;
			if (data === undefined) data = {};
			var handlers = Arrays.clone(this.handlers);
			for (var i = 0, c = handlers.length; i < c; i++) {
				var h = handlers[i];
				h.handler.call(h.context, data);
			}
		}
	}, {
		key: 'mute',
		value: function mute(inc /* = 1 */) {
			if (inc === undefined) inc = 1;
			this._mute += inc;
		}
	}, {
		key: 'getLength',
		value: function getLength() {
			return this.handlers.length;
		}
	}]);

	return Delegate;
}();

// ====================================================

module.exports = {
	// JS
	parseInt: parseInt, parseFloat: parseFloat, parseDate: parseDate,
	// Arrays
	Arrays: Arrays,
	// Strings
	cutString: cutString,
	// HTML
	htmlEncode: htmlEncode,
	// DOM
	createFromHtml: createFromHtml,
	// L18N
	plural: plural,
	// Delegate
	Delegate: Delegate
};

},{}],52:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var DataView = function (_View) {
	_inherits(DataView, _View);

	function DataView(loadController) {
		_classCallCheck(this, DataView);

		var _this = _possibleConstructorReturn(this, (DataView.__proto__ || Object.getPrototypeOf(DataView)).call(this));

		var me = _this;
		me._loadController = loadController;

		loadController.onOperationStart.bind(function () {
			me._clearReport();
		});
		loadController.onOperationEnd.bind(function ( /* optional */ex) {
			if (ex) me._reportError(ex);
		});
		return _this;
	}

	_createClass(DataView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"dataview\">\n\t\t\t\t<div id=\"" + (this.uid + "_messages") + "\"></div>\n\t\t\t\t\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435:\n\t\t\t\t<ul class=\"dataview_sources\">\n\t\t\t\t\t<li>" + renderLink(this._loadController.participantsRegistryUrl) + "</li>\n\t\t\t\t\t<li>" + renderLink(this._loadController.ownersRegistryUrl) + "</li>\n\t\t\t\t\t<li>\n\t\t\t\t\t\t" + renderLink(this._loadController.apartmentsWithoutSectionUrl) + "\n\t\t\t\t\t\t<label>\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0432\u043E\u0439 \u0444\u0430\u0439\u043B: <input type=\"file\" id=\"" + (this.uid + "_apartmentsWithoutSection") + "\"></label>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li>\n\t\t\t\t\t\t" + renderLink(this._loadController.incorrectApartmentsUrl) + "\n\t\t\t\t\t\t<label>\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0432\u043E\u0439 \u0444\u0430\u0439\u043B: <input type=\"file\" id=\"" + (this.uid + "_incorrectApartments") + "\"></label>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li>\n\t\t\t\t\t\t" + renderLink(this._loadController.oldApartmentNumbersUrl) + "\n\t\t\t\t\t\t<label>\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0432\u043E\u0439 \u0444\u0430\u0439\u043B: <input type=\"file\" id=\"" + (this.uid + "_oldApartmentNumbers") + "\"></label>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li>\n\t\t\t\t\t\t" + renderLink(this._loadController.juridicalPersonsUrl) + "\n\t\t\t\t\t\t<label>\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0432\u043E\u0439 \u0444\u0430\u0439\u043B: <input type=\"file\" id=\"" + (this.uid + "_juridicalPersons") + "\"></label>\n\t\t\t\t\t</li>\n\t\t\t\t</ul>\n\t\t\t\t<button id=\"" + (this.uid + "_refresh") + "\">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C</button>\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(DataView.prototype.__proto__ || Object.getPrototypeOf(DataView.prototype), "onInstalled", this).apply(this, arguments);

			var me = this;
			var $el = me.$element();

			$el.find("#" + this.uid + "_apartmentsWithoutSection").change(function (ev) {
				var file = ev.target.files[0];
				file ? me._loadController.loadApartmentsWithoutSection(file) : me._loadController.loadDefaultApartmentsWithoutSection();
			});
			$el.find("#" + this.uid + "_incorrectApartments").change(function (ev) {
				var file = ev.target.files[0];
				file ? me._loadController.loadIncorrectApartments(file) : me._loadController.loadDefaultIncorrectApartments();
			});
			$el.find("#" + this._uid + "_oldApartmentNumbers").change(function (ev) {
				var file = ev.target.files[0];
				file ? me._loadController.loadOldApartmentNumbers(file) : me._loadController.loadDefaultOldApartmentNumbers();
			});
			$el.find("#" + this._uid + "_juridicalPersons").change(function (ev) {
				var file = ev.target.files[0];
				file ? me._loadController.loadJuridicalPersons(file) : me._loadController.loadDefaultJuridicalPersons();
			});
			$el.find("#" + this.uid + "_refresh").click(function () {
				me._refresh();
			});
		}
	}, {
		key: "_refresh",
		value: function _refresh() {
			this._loadController.updateModel();
		}
	}, {
		key: "_clearReport",
		value: function _clearReport() {
			this.$element().find("#" + this.uid + "_messages").html("");
		}
	}, {
		key: "_reportError",
		value: function _reportError(ex) {
			this.$element().find("#" + this.uid + "_messages").text(ex.message);
		}
	}]);

	return DataView;
}(View);

module.exports = DataView;

var utils = require("app/utils");

function renderLink(url) {
	var filename = url.substring(url.lastIndexOf("/") + 1);
	return "<a href=\"" + url + "\" target=\"_blank\">" + utils.htmlEncode(filename) + "</a>";
}

},{"app/utils":51,"app/views/View":63}],53:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var Grid = function (_View) {
	_inherits(Grid, _View);

	function Grid(model, searchModel, recordSelectionModel) {
		_classCallCheck(this, Grid);

		var _this = _possibleConstructorReturn(this, (Grid.__proto__ || Object.getPrototypeOf(Grid)).call(this));

		var me = _this;

		me.objectPopup = me.addChild(new ObjectPopup());

		me._model = model;
		me._searchModel = searchModel;
		me._recordSelectionModel = recordSelectionModel;

		me._searchModel.onChanged.bind(function () {
			me._showSearchResults();
		});
		me._recordSelectionModel.onChanged.bind(function () {
			me._showSelectedRecord();
		});
		return _this;
	}

	_createClass(Grid, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"grid\">\n\t\t\t\t" + this.objectPopup.getHtml() + "\n\t\t\t\t<div class=\"grid_content\"></div>\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(Grid.prototype.__proto__ || Object.getPrototypeOf(Grid.prototype), "onInstalled", this).apply(this, arguments);
			var me = this;
			me.$element().click(function (ev) {
				var $t = $(ev.target);
				var $e = $t.closest(".grid_object");
				if ($e.length) {
					var id = $e[0].id;
					var prefix = me.uid + "_obj-";
					if (id && id.startsWith(prefix)) {
						id = id.substring(prefix.length);
						me._selectObject(id, ev);
					}
				}
			});
		}
	}, {
		key: "redraw",
		value: function redraw() {
			this.objectPopup.hide();

			var acc = [];
			render(this.uid, this._model.objects, this._searchModel.getObjectIds(), acc);
			this.$element().children(".grid_content").html(acc.join(""));
		}
	}, {
		key: "_showSearchResults",
		value: function _showSearchResults() {
			var $el = this.$element();
			if (!$el.length) return;
			$el.find(".grid_object__search").removeClass("grid_object__search");
			var ids = this._searchModel.getObjectIds();
			for (var i = 0, c = ids.length; i < c; i++) {
				var id = ids[i];
				$el.find("#" + this.uid + "_obj-" + id).addClass("grid_object__search");
			}
		}
	}, {
		key: "_showSelectedRecord",
		value: function _showSelectedRecord() {
			var $el = this.$element();
			if (!$el.length) return;
			$el.find(".grid_object__selectedRecord").removeClass("grid_object__selectedRecord");
			var record = this._recordSelectionModel.getRecord();
			if (record) for (var i = 0, c = record.objects.length; i < c; i++) {
				var obj = record.objects[i];
				$el.find("#" + this.uid + "_obj-" + obj.id).addClass("grid_object__selectedRecord");
			}
		}
	}, {
		key: "_selectObject",
		value: function _selectObject(objectId, ev) {
			var object = this._model.getObjectById(objectId);
			if (!object) return;

			this._recordSelectionModel.setRecord(object.record);

			this.objectPopup.setObject(object);
			this.objectPopup.show(ev);
		}
	}]);

	return Grid;
}(View);

module.exports = Grid;

var utils = require("app/utils");
var ObjectPopup = require("app/views/ObjectPopup");
var GridView = require("app/views/GridView");
var m = require("app/model/ModelClasses");
var s = require("app/Strings");

function render(gridUid, objects, searchResults, acc) {
	objects.sort(function (a, b) {
		return GridView.isSupportedObject(a) - GridView.isSupportedObject(b) || a.building - b.building || (a.section == null) - (b.section == null) || a.section - b.section || (a.floor == null) - (b.floor == null) || b.floor - a.floor || a.number - b.number || (a.record.date != null) - (b.record.date != null) || a.record.date - b.record.date;
	});

	var lastBuilding = null;
	var lastSection = null;
	var lastFloor = null;
	var lastType = null;

	for (var i = 0, c = objects.length; i < c; i++) {
		var obj = objects[i];
		if (!GridView.isSupportedObject(obj)) continue;

		var building = obj.building;
		var section = obj.section;
		if (building != lastBuilding || section != lastSection) {
			if (lastFloor != null || lastType != null) {
				acc.push("</div>");
				lastFloor = null;
				lastType = null;
			}
			if (lastBuilding != null) {
				renderBuildingAndSectionInfo(lastBuilding, lastSection, acc);
				acc.push("</div>");
			}

			acc.push("<div class='grid_section'>");
			lastBuilding = building;
			lastSection = section;
		}

		var floor = obj.floor;
		var type = obj.constructor.name;
		if (floor != lastFloor || type != lastType) {
			if (lastFloor != null || lastType != null) acc.push("</div>");
			acc.push("<div class='grid_floor grid_floor__" + type + "'>");
			renderFloorInfo(obj, acc);
			lastFloor = floor;
			lastType = type;
		}

		renderObjectInfo(gridUid, obj, searchResults, acc);
	}

	acc.push("</div>");
	renderBuildingAndSectionInfo(lastBuilding, lastSection, acc);
	acc.push("</div>");
}

function renderBuildingAndSectionInfo(lastBuilding, lastSection, acc) {
	acc.push("<div class='grid_sectionInfo'>\u041A\u043E\u0440\u043F\u0443\u0441 " + lastBuilding + " \u0421\u0435\u043A\u0446\u0438\u044F " + (lastSection == null ? s.Unknown : lastSection) + "</div>");
}

function renderFloorInfo(obj, acc) {
	if (obj instanceof m.Apartment) {
		acc.push("<span class='grid_floorNumber'>");
		acc.push(utils.htmlEncode(obj.floor.toString()));
		acc.push("</span>");
	} else if (obj instanceof m.NonResidentialPremise) acc.push("<span class='grid_floorNumber' title='\u041D\u0435\u0436\u0438\u043B\u044B\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F'>" + s.Cross + "</span>");
}

function renderObjectInfo(gridUid, obj, searchResults, acc) {
	var cssClasses = ["grid_object"];
	if (obj.duplicate) cssClasses.push("grid_object__duplicate");
	if (obj.originalNumber != null) cssClasses.push("grid_object__withOriginalNumber");
	if (searchResults.indexOf(obj.id) >= 0) cssClasses.push("grid_object__search");
	cssClasses = cssClasses.join(" ");

	acc.push("<div class=\"" + cssClasses + "\" id=\"" + (gridUid + "_obj-" + obj.id) + "\">");
	if (obj.number != null) acc.push(utils.htmlEncode(obj.number.toString()));
	acc.push("</div>");
}

},{"app/Strings":34,"app/model/ModelClasses":38,"app/utils":51,"app/views/GridView":54,"app/views/ObjectPopup":57,"app/views/View":63}],54:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var GridView = function (_View) {
	_inherits(GridView, _View);

	function GridView(model) {
		_classCallCheck(this, GridView);

		var _this = _possibleConstructorReturn(this, (GridView.__proto__ || Object.getPrototypeOf(GridView)).call(this));

		var me = _this;

		var searchModel = new SearchModel();
		var recordSelectionModel = new RecordSelectionModel();
		me.searchView = me.addChild(new SearchView(model, searchModel));
		me.recordInfo = me.addChild(new RecordInfo(recordSelectionModel));
		me.grid = me.addChild(new Grid(model, searchModel, recordSelectionModel));

		// handle this signal here to control the order of child views' updates
		model.onChanged.bind(function () {
			recordSelectionModel.clear();
			searchModel.onChanged.mute();
			me.searchView.apply();
			searchModel.onChanged.mute(-1);
			me.grid.redraw();
		});
		return _this;
	}

	_createClass(GridView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"gridview\">\n\t\t\t\t<div class=\"gridview_sidebar\">\n\t\t\t\t\t" + this.searchView.getHtml() + "\n\t\t\t\t\t" + this.recordInfo.getHtml() + "\n\t\t\t\t</div>\n\t\t\t\t" + this.grid.getHtml() + "\n\t\t\t</div>\n\t\t";
		}
	}]);

	return GridView;
}(View);

GridView.isSupportedObject = function (obj) {
	return obj instanceof m.Apartment || obj instanceof m.NonResidentialPremise;
};

module.exports = GridView;

var Grid = require("app/views/Grid");
var SearchView = require("app/views/SearchView");
var SearchModel = require("app/model/SearchModel");
var RecordSelectionModel = require("app/model/RecordSelectionModel");
var RecordInfo = require("app/views/RecordInfo");
var m = require("app/model/ModelClasses");

},{"app/model/ModelClasses":38,"app/model/RecordSelectionModel":39,"app/model/SearchModel":40,"app/views/Grid":53,"app/views/RecordInfo":59,"app/views/SearchView":60,"app/views/View":63}],55:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var IncompatibleBrowserView = function (_View) {
	_inherits(IncompatibleBrowserView, _View);

	function IncompatibleBrowserView() {
		_classCallCheck(this, IncompatibleBrowserView);

		return _possibleConstructorReturn(this, (IncompatibleBrowserView.__proto__ || Object.getPrototypeOf(IncompatibleBrowserView)).apply(this, arguments));
	}

	_createClass(IncompatibleBrowserView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"incompatiblebrowser\">\n\t\t\t\t\u041A \u0441\u043E\u0436\u0430\u043B\u0435\u043D\u0438\u044E, \u0412\u0430\u0448\u0430 \u0432\u0435\u0440\u0441\u0438\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.<br/>\n\t\t\t\t\u0414\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0448\u0430\u0445\u043C\u0430\u0442\u043A\u0438 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0432\u0435\u0440\u0441\u0438\u044E \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043E\u0432 Google Chrome, Mozilla Firefox \u0438\u043B\u0438 Microsoft Edge.\n\t\t\t</div>";
		}
	}]);

	return IncompatibleBrowserView;
}(View);

module.exports = IncompatibleBrowserView;

},{"app/views/View":63}],56:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var MainView = function (_View) {
	_inherits(MainView, _View);

	function MainView(model, loadController) {
		_classCallCheck(this, MainView);

		var _this = _possibleConstructorReturn(this, (MainView.__proto__ || Object.getPrototypeOf(MainView)).call(this));

		MainView.instance = _this;
		var me = _this;

		me._loadController = loadController;

		me.popupManager = new PopupManager();

		me.tabControl = me.addChild(new TabControl());
		me.tabControl.addTab(Tab.Data, "Данные");
		me.tabControl.addTab(Tab.Grid, "Шахматка");
		me.tabControl.addTab(Tab.Sql, "SQL");

		me.dataView = me.addChild(new DataView(loadController));
		me.gridView = me.addChild(new GridView(model));
		me.sqlView = me.addChild(new SqlView(model.sqlModel));
		me._onTabChanged();

		me.tabControl.onActiveIdChanged.bind(function () {
			me._onTabChanged();
		});

		model.onChanged.bind(function () {
			if (me.getActiveTab() == Tab.Data) me.setActiveTab(Tab.Grid);
		});
		return _this;
	}

	_createClass(MainView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"mainview\">\n\t\t\t\t" + this.tabControl.getHtml() + "\n\t\t\t\t" + this.dataView.getHtml() + "\n\t\t\t\t" + this.gridView.getHtml() + "\n\t\t\t\t" + this.sqlView.getHtml() + "\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "getActiveTab",
		value: function getActiveTab() {
			return this.tabControl.activeId();
		}
	}, {
		key: "setActiveTab",
		value: function setActiveTab(value) {
			if (this.tabControl.activeId(value)) this._onTabChanged();
		}
	}, {
		key: "_onTabChanged",
		value: function _onTabChanged() {
			var id = this.tabControl.activeId();
			this.dataView.setVisible(id == Tab.Data);
			this.gridView.setVisible(id == Tab.Grid);
			this.sqlView.setVisible(id == Tab.Sql);
		}
	}]);

	return MainView;
}(View);

var Tab = {
	Data: 1,
	Grid: 2,
	Sql: 3
};

MainView.instance = null;
MainView.Tab = Tab;

module.exports = MainView;

var TabControl = require("app/views/TabControl");
var DataView = require("app/views/DataView");
var GridView = require("app/views/GridView");
var SqlView = require("app/views/SqlView");
var PopupManager = require("app/views/PopupManager");

},{"app/views/DataView":52,"app/views/GridView":54,"app/views/PopupManager":58,"app/views/SqlView":61,"app/views/TabControl":62,"app/views/View":63}],57:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var ObjectPopup = function (_View) {
	_inherits(ObjectPopup, _View);

	function ObjectPopup() {
		_classCallCheck(this, ObjectPopup);

		return _possibleConstructorReturn(this, (ObjectPopup.__proto__ || Object.getPrototypeOf(ObjectPopup)).apply(this, arguments));
	}

	_createClass(ObjectPopup, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"objectpopup\">\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(ObjectPopup.prototype.__proto__ || Object.getPrototypeOf(ObjectPopup.prototype), "onInstalled", this).apply(this, arguments);
		}
	}, {
		key: "setObject",
		value: function setObject(object) {
			var acc = [];
			render(object, acc);
			this.$element().html(acc.join(""));
		}
	}, {
		key: "show",
		value: function show(ev) {
			var $el = this.$element();

			var left = ev.pageX;
			var top = ev.pageY;
			$el.css({ left: left, top: top }).show();

			var w = $el.outerWidth();
			if (left + w > window.scrollX + window.innerWidth && left - w > window.scrollX) $el.css("left", left - w);

			var h = $el.outerHeight();
			if (top + h > window.scrollY + window.innerHeight && top - h > window.scrollY) $el.css("top", top - h);

			MainView.instance.popupManager.registerPopup($el[0]);
		}
	}, {
		key: "hide",
		value: function hide() {
			this.$element().hide();
		}
	}]);

	return ObjectPopup;
}(View);

module.exports = ObjectPopup;

var utils = require("app/utils");
var s = require("app/Strings");
var m = require("app/model/ModelClasses");
var MainView = require("app/views/MainView");

function render(obj, acc) {
	acc.push(utils.htmlEncode(obj.type));
	acc.push(" №");
	if (obj.originalNumber != null) {
		acc.push("<span class='objectpopup_withOriginalNumber'>");
		acc.push(utils.htmlEncode(obj.number.toString()));
		acc.push("</span>");
		acc.push(" (");
		acc.push(utils.htmlEncode(obj.originalNumber.toString()));
		acc.push(")");
	} else acc.push(utils.htmlEncode(obj.number.toString()));
	acc.push("<br>");

	acc.push("Корпус ");
	acc.push(utils.htmlEncode(obj.building.toString()));
	acc.push(", секция ");
	acc.push(obj.section == null ? s.Unknown : utils.htmlEncode(obj.section.toString()));
	acc.push(", этаж ");
	acc.push(obj.floor == null ? s.Unknown : utils.htmlEncode(obj.floor.toString()));
	acc.push("<br>");

	acc.push("Номер на площадке ");
	acc.push(obj.landingNumber == null ? s.Unknown : utils.htmlEncode(obj.landingNumber.toString()));
	acc.push("<br>");

	acc.push("Площадь ");
	acc.push(obj.area.toString());
	acc.push(" кв.м.");
	acc.push("<br>");

	acc.push(obj.record.type);
	acc.push(obj.record instanceof m.OwnersRegistryRecord ? ",<br>" : ", ");
	acc.push("запись №");
	acc.push(utils.htmlEncode(obj.record.number.toString()));
	acc.push("<br>");

	acc.push("Дата регистрации ");
	acc.push(obj.record.date == null ? s.Unknown : utils.htmlEncode(s.formatDate(obj.record.date)));
}

},{"app/Strings":34,"app/model/ModelClasses":38,"app/utils":51,"app/views/MainView":56,"app/views/View":63}],58:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PopupManager = function () {
	function PopupManager() {
		_classCallCheck(this, PopupManager);

		var me = this;
		me._activePopup = null; /* : DOMElement */
		$(document.body).mousedown(function (ev) {
			if (me._activePopup && $(ev.target).closest(me._activePopup).length == 0) me._hide();
		});
	}

	_createClass(PopupManager, [{
		key: "registerPopup",
		value: function registerPopup(el) {
			if (!el) throw new Error("Argument is null: el");
			if (el == this._activePopup) return;
			this._hide();
			this._activePopup = el;
		}
	}, {
		key: "_hide",
		value: function _hide() {
			if (this._activePopup) {
				$(this._activePopup).hide();
				this._activePopup = null;
			}
		}
	}]);

	return PopupManager;
}();

module.exports = PopupManager;

},{}],59:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var RecordInfo = function (_View) {
	_inherits(RecordInfo, _View);

	function RecordInfo(recordSelectionModel) {
		_classCallCheck(this, RecordInfo);

		var _this = _possibleConstructorReturn(this, (RecordInfo.__proto__ || Object.getPrototypeOf(RecordInfo)).call(this));

		var me = _this;
		me._recordSelectionModel = recordSelectionModel;

		me._recordSelectionModel.onChanged.bind(function () {
			var record = me._recordSelectionModel.getRecord();
			me._redraw(record);
		});
		return _this;
	}

	_createClass(RecordInfo, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"recordinfo\">\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(RecordInfo.prototype.__proto__ || Object.getPrototypeOf(RecordInfo.prototype), "onInstalled", this).apply(this, arguments);
			var me = this;

			me.$element().click(function (ev) {
				if ($(ev.target).closest(".recordinfo_close").length) me._recordSelectionModel.clear();
			});
		}
	}, {
		key: "_redraw",
		value: function _redraw( /* optional */record) {
			var acc = [];
			if (record) render(record, acc);
			this.$element().html(acc.join(""));
		}
	}]);

	return RecordInfo;
}(View);

module.exports = RecordInfo;

var utils = require("app/utils");
var m = require("app/model/ModelClasses");
var s = require("app/Strings");

function render(record, acc) {
	acc.push("<div class='caption'>\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0437\u0430\u043F\u0438\u0441\u0438 <span class='recordinfo_close'>" + s.Cross + "</span></div>");
	acc.push(utils.htmlEncode(record.type));
	acc.push(", №");
	acc.push(utils.htmlEncode(record.number.toString()));
	acc.push("<br/>");

	if (record instanceof m.ParticipantsRegistryRecord) {
		acc.push("<div class='recordinfo_source'>");
		acc.push(utils.htmlEncode(record.source));
		acc.push("</div>");
	} else if (record instanceof m.OwnersRegistryRecord) acc.push(utils.htmlEncode(record.owner));else throw new Error("Неизвестный тип записи: " + record.constructor.name);
}

},{"app/Strings":34,"app/model/ModelClasses":38,"app/utils":51,"app/views/View":63}],60:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var SearchView = function (_View) {
	_inherits(SearchView, _View);

	function SearchView(model, searchModel) {
		_classCallCheck(this, SearchView);

		var _this = _possibleConstructorReturn(this, (SearchView.__proto__ || Object.getPrototypeOf(SearchView)).call(this));

		_this._model = model;
		_this._searchModel = searchModel;
		return _this;
	}

	_createClass(SearchView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"searchview\">\n\t\t\t\t<div class=\"caption\">\u041F\u043E\u0438\u0441\u043A</div>\n\t\t\t\t<label>\u0422\u0438\u043F \u0437\u0430\u043F\u0438\u0441\u0438: <select id=\"" + (this.uid + "_recordType") + "\">\n\t\t\t\t\t<option>\n\t\t\t\t\t<option value=\"\u0415\u0413\u0420\u041F\">\u0415\u0413\u0420\u041F</option>\n\t\t\t\t\t<option value=\"\u0420\u0435\u0435\u0441\u0442\u0440 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u043E\u0432 \u0434\u043E\u043B\u0435\u0439\">\u0420\u0435\u0435\u0441\u0442\u0440 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u043E\u0432 \u0434\u043E\u043B\u0435\u0439</option>\n\t\t\t\t</select></label>\n\t\t\t\t<label>\u041D\u043E\u043C\u0435\u0440 \u0437\u0430\u043F\u0438\u0441\u0438: <input id=\"" + (this.uid + "_recordNumber") + "\" size=\"5\"></label>\n\t\t\t\t<label>\u0422\u0435\u043A\u0441\u0442 \u0432 \u0437\u0430\u043F\u0438\u0441\u0438:<br/><input id=\"" + (this.uid + "_recordText") + "\" size=\"40\"></label>\n\t\t\t\t\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438\n\t\t\t\t\t<label>\u0441 <input type=\"date\" id=\"" + (this.uid + "_dateFrom") + "\"></label>\n\t\t\t\t\t<label>\u043F\u043E <input type=\"date\" id=\"" + (this.uid + "_dateTo") + "\"></label>\n\t\t\t\t<label>\u041B\u0438\u0446\u043E: <select id=\"" + (this.uid + "_person") + "\">\n\t\t\t\t\t<option>\n\t\t\t\t\t<option value=\"physical\">\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u043E\u0435</option>\n\t\t\t\t\t<option value=\"juridical\">\u042E\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043A\u043E\u0435</option>\n\t\t\t\t</select></label>\n\t\t\t\t<label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0432 \u0437\u0430\u043F\u0438\u0441\u0438 \u2265 <input id=\"" + (this.uid + "_objectsCountGe") + "\" size=\"5\"></label>\n\t\t\t\t<label>\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u0432\u0430\u0440\u0442\u0438\u0440 \u0432 \u0437\u0430\u043F\u0438\u0441\u0438 \u2265 <input id=\"" + (this.uid + "_apartmentsCountGe") + "\" size=\"5\"></label>\n\t\t\t\t<label>\u041D\u043E\u043C\u0435\u0440 \u043E\u0431\u044A\u0435\u043A\u0442\u0430: <input id=\"" + (this.uid + "_number") + "\" size=\"5\"></label>\n\t\t\t\t<button id=\"" + (this.uid + "_apply") + "\">\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C</button>\n\t\t\t\t<div class=\"searchview_searchStats\">\n\t\t\t\t\t\u041D\u0430\u0439\u0434\u0435\u043D\u043E <span id=\"" + (this.uid + "_foundObjectsCount") + "\">0 \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432</span>\n\t\t\t\t\t(\u0438\u0437 \u043D\u0438\u0445 <span id=\"" + (this.uid + "_foundApartmentsCount") + "\">0 \u043A\u0432\u0430\u0440\u0442\u0438\u0440</span>)\n\t\t\t\t\t\u0432 <span id=\"" + (this.uid + "_foundRecordsCount") + "\">0 \u0437\u0430\u043F\u0438\u0441\u044F\u0445</span>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(SearchView.prototype.__proto__ || Object.getPrototypeOf(SearchView.prototype), "onInstalled", this).apply(this, arguments);

			var me = this;
			var $el = me.$element();

			$el.find("#" + me.uid + "_apply").click(function () {
				me.apply();
			});

			$el.find(":input").bind("change input", function () {
				me.apply();
			});
		}
	}, {
		key: "apply",
		value: function apply() {
			var ids = [];
			var recordIds = {};

			var filters = this._getFilters();
			if (filters) {
				var objects = this._model.objects;
				for (var i = 0, c = objects.length; i < c; i++) {
					var obj = objects[i];
					if (!GridView.isSupportedObject(obj)) continue;

					if (filters.recordType && obj.record.type != filters.recordType) continue;
					if (filters.recordNumber != null && obj.record.number != filters.recordNumber) continue;
					if (filters.recordText && !(obj.record.source != null && obj.record.source.toLowerCase().indexOf(filters.recordText.toLowerCase()) >= 0 || obj.record.owner != null && obj.record.owner.toLowerCase().indexOf(filters.recordText.toLowerCase()) >= 0)) continue;
					if (filters.dateFrom && !(obj.record.date && obj.record.date >= filters.dateFrom)) continue;
					if (filters.dateTo && !(obj.record.date && obj.record.date <= filters.dateTo)) continue;
					if (filters.person) {
						if (filters.person == "juridical" && obj.record.owner) continue;
						if (filters.person == "physical" && !obj.record.owner) continue;
					}
					if (filters.number != null && !(obj.number == filters.number || obj.originalNumber == filters.number)) continue;
					if (filters.objectsCountGe != null && obj.record.objects.length < filters.objectsCountGe) continue;
					if (filters.apartmentsCountGe != null && obj.record.objects.filter(function (obj) {
						return obj instanceof m.Apartment;
					}).length < filters.apartmentsCountGe) continue;

					ids.push(obj.id);
					recordIds[obj.record.id] = true;
				}
			}

			this._showSearchStats(ids, recordIds);
			this._searchModel.setObjectIds(ids);
		}
	}, {
		key: "_getFilters",
		value: function _getFilters() {
			var $el = this.$element();

			var $recordType = $el.find("#" + this.uid + "_recordType").removeClass("error");
			var $recordNumber = $el.find("#" + this.uid + "_recordNumber").removeClass("error");
			var $recordText = $el.find("#" + this.uid + "_recordText").removeClass("error");
			var $dateFrom = $el.find("#" + this.uid + "_dateFrom").removeClass("error");
			var $dateTo = $el.find("#" + this.uid + "_dateTo").removeClass("error");
			var $person = $el.find("#" + this.uid + "_person").removeClass("error");
			var $number = $el.find("#" + this.uid + "_number").removeClass("error");
			var $objectsCountGe = $el.find("#" + this.uid + "_objectsCountGe").removeClass("error");
			var $apartmentsCountGe = $el.find("#" + this.uid + "_apartmentsCountGe").removeClass("error");

			var recordType = $recordType.val();

			var recordNumber = $recordNumber.val();
			if (!recordNumber) recordNumber = null;else {
				recordNumber = utils.parseInt(recordNumber);
				if (recordNumber == null) $recordNumber.addClass("error");
			}

			var recordText = $recordText.val();

			var dateFrom = $dateFrom.val();
			if (!dateFrom) dateFrom = null;else {
				dateFrom = utils.parseDate(dateFrom);
				if (dateFrom == null) $dateFrom.addClass("error");
			}

			var dateTo = $dateTo.val();
			if (!dateTo) dateTo = null;else {
				dateTo = utils.parseDate(dateTo);
				if (dateTo == null) $dateTo.addClass("error");
			}

			var person = $person.val();

			var number = $number.val();
			if (!number) number = null;else {
				number = utils.parseInt(number);
				if (number == null) $number.addClass("error");
			}

			var objectsCountGe = $objectsCountGe.val();
			if (!objectsCountGe) objectsCountGe = null;else {
				objectsCountGe = utils.parseInt(objectsCountGe);
				if (objectsCountGe == null) $objectsCountGe.addClass("error");
			}

			var apartmentsCountGe = $apartmentsCountGe.val();
			if (!apartmentsCountGe) apartmentsCountGe = null;else {
				apartmentsCountGe = utils.parseInt(apartmentsCountGe);
				if (apartmentsCountGe == null) $apartmentsCountGe.addClass("error");
			}

			if (!recordType && recordNumber == null && !recordText && !dateFrom && !dateTo && !person && number == null && objectsCountGe == null && apartmentsCountGe == null) return null;
			return { recordType: recordType, recordNumber: recordNumber, recordText: recordText, dateFrom: dateFrom, dateTo: dateTo, person: person, number: number, objectsCountGe: objectsCountGe, apartmentsCountGe: apartmentsCountGe };
		}
	}, {
		key: "_showSearchStats",
		value: function _showSearchStats(objectIds /* : [] */, recordIds /* : {} */) {
			var objectsCount = objectIds.length;

			var apartmentsCount = 0;
			for (var i = 0; i < objectIds.length; i++) {
				var obj = this._model.getObjectById(objectIds[i]);
				if (obj instanceof m.Apartment) apartmentsCount++;
			}

			var recordsCount = 0;
			for (var id in recordIds) {
				if (recordIds.hasOwnProperty(id)) recordsCount++;
			}var $el = this.$element();
			var $foundObjectsCount = $el.find("#" + this.uid + "_foundObjectsCount");
			var $foundApartmentsCount = $el.find("#" + this.uid + "_foundApartmentsCount");
			var $foundRecordsCount = $el.find("#" + this.uid + "_foundRecordsCount");
			$foundObjectsCount.text(objectsCount + " " + utils.plural(objectsCount, ["объект", "объекта", "объектов"]));
			$foundApartmentsCount.text(apartmentsCount + " " + utils.plural(apartmentsCount, ["квартира", "квартиры", "квартир"]));
			$foundRecordsCount.text(recordsCount + " " + utils.plural(recordsCount, ["записи", "записях", "записях"]));
		}
	}]);

	return SearchView;
}(View);

module.exports = SearchView;

var m = require("app/model/ModelClasses");
var utils = require("app/utils");
var GridView = require("app/views/GridView");

},{"app/model/ModelClasses":38,"app/utils":51,"app/views/GridView":54,"app/views/View":63}],61:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var Example = "\nSELECT r.source\nFROM Apartment a\nJOIN Record r ON r.id = a.recordId\nWHERE a.number = 1\n".trim();

var SqlView = function (_View) {
	_inherits(SqlView, _View);

	function SqlView(sqlModel) {
		_classCallCheck(this, SqlView);

		var _this = _possibleConstructorReturn(this, (SqlView.__proto__ || Object.getPrototypeOf(SqlView)).call(this));

		_this._sqlModel = sqlModel;
		return _this;
	}

	_createClass(SqlView, [{
		key: "getHtml",
		value: function getHtml() {
			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"sqlview\">\n\t\t\t\t<div class=\"sqlview_wrapper\">\n\t\t\t\t\t<div class=\"sqlview_controls\">\n\t\t\t\t\t\t<textarea cols=\"40\" rows=\"20\"></textarea><br/>\n\t\t\t\t\t\t<button id=\"" + (this.uid + "_example") + "\" class=\"sqlview_btnExample\">\u041F\u0440\u0438\u043C\u0435\u0440</button>\n\t\t\t\t\t\t<button id=\"" + (this.uid + "_query") + "\">\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C</button>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"sqlview_schema\">\n\t\t\t\t\t\t<div class=\"caption\">\u0421\u0445\u0435\u043C\u0430:</div>\n\t\t\t\t\t\t<pre>" + utils.htmlEncode(SqlModel.Schema) + "</pre>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div id=\"" + (this.uid + "_messages") + "\" class=\"sqlview_messages\"></div>\n\t\t\t\t<div id=\"" + (this.uid + "_results") + "\"></div>\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(SqlView.prototype.__proto__ || Object.getPrototypeOf(SqlView.prototype), "onInstalled", this).apply(this, arguments);
			var me = this;

			this.$element().find("#" + this.uid + "_query").click(function () {
				var sql = me.$element().find("textarea").val();
				me._query(sql);
			});

			this.$element().find("#" + this.uid + "_example").click(function () {
				me.$element().find("textarea").val(Example);
				me._query(Example);
			});
		}
	}, {
		key: "_query",
		value: function _query(sql) {
			this._clearReport();
			this._clearResults();

			if (sql.trim().length == 0) {
				this._reportFailure("Введите запрос");
				return;
			}

			try {
				var res = this._sqlModel.query(sql);
			} catch (ex) {
				this._reportError(ex);
				return;
			}
			this._showResults(res);
		}
	}, {
		key: "_clearReport",
		value: function _clearReport() {
			var $messages = this.$element().find("#" + this.uid + "_messages");
			$messages.empty();
		}
	}, {
		key: "_reportFailure",
		value: function _reportFailure(message) {
			var $messages = this.$element().find("#" + this.uid + "_messages");
			$messages.text(message);
		}
	}, {
		key: "_reportError",
		value: function _reportError(ex) {
			this._reportFailure(ex.message);
		}
	}, {
		key: "_clearResults",
		value: function _clearResults() {
			var $results = this.$element().find("#" + this.uid + "_results");
			$results.empty();
		}
	}, {
		key: "_showResults",
		value: function _showResults(datasets) {
			var $results = this.$element().find("#" + this.uid + "_results");
			var acc = [];
			for (var i = 0, c = datasets.length; i < c; i++) {
				renderDataset(datasets[i], acc);
			}$results.html(acc.join(""));
		}
	}]);

	return SqlView;
}(View);

module.exports = SqlView;

var utils = require("app/utils");
var SqlModel = require("app/model/SqlModel");

function renderDataset(dataset, acc) {
	if (dataset.length == 0) {
		acc.push("<table><tr><td><em>Нет результатов</em></td></tr></div>");
		return;
	}
	acc.push("<table>");
	for (var i = 0, c = dataset.length; i < c; i++) {
		var row = dataset[i];
		acc.push("<tr>");
		for (var j = 0, cj = row.length; j < cj; j++) {
			acc.push("<td>");
			var value = row[j];
			if (value != null) acc.push(utils.htmlEncode(row[j].toString()));
		}
	}
	acc.push("</table>");
}

},{"app/model/SqlModel":41,"app/utils":51,"app/views/View":63}],62:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var View = require("app/views/View");

var TabControl = function (_View) {
	_inherits(TabControl, _View);

	function TabControl() {
		_classCallCheck(this, TabControl);

		var _this = _possibleConstructorReturn(this, (TabControl.__proto__ || Object.getPrototypeOf(TabControl)).call(this));

		_this._tabs = [];
		_this._activeId = null;
		_this.onActiveIdChanged = new utils.Delegate();
		return _this;
	}

	_createClass(TabControl, [{
		key: "addTab",
		value: function addTab(id, title) {
			if (id == null) throw new Error("Argument null: id");
			this._tabs.push({ id: id, title: title });
		}
		// @get/set

	}, {
		key: "activeId",
		value: function activeId( /* optional */value) {
			if (value === undefined) return this._activeId;
			return this._setActiveId(value, /* signal = */false);
		}
	}, {
		key: "_setActiveId",
		value: function _setActiveId(value, signal /* = false */) {
			if (this._activeId == value) return false;
			if (this._activeId != null) this.$element().find("#" + this.uid + "_tab-" + this._activeId).removeClass("tabcontrol_tab__active");
			this._activeId = value;
			this.$element().find("#" + this.uid + "_tab-" + this._activeId).addClass("tabcontrol_tab__active");
			if (signal) this.onActiveIdChanged.trigger();
			return true;
		}
	}, {
		key: "getHtml",
		value: function getHtml() {
			var _this2 = this;

			return "\n\t\t\t<div id=\"" + this.uid + "\" class=\"tabcontrol\">\n\t\t\t\t" + this._tabs.map(function (tab) {
				return "<span\n\t\t\t\t\tclass=\"tabcontrol_tab " + (tab.id == _this2._activeId ? "tabcontrol_tab__active" : "") + "\"\n\t\t\t\t\tid=\"" + (_this2.uid + "_tab-" + tab.id) + "\">\n\t\t\t\t\t" + utils.htmlEncode(tab.title) + "\n\t\t\t\t</span>";
			}).join("") + "\n\t\t\t</div>\n\t\t";
		}
	}, {
		key: "onInstalled",
		value: function onInstalled() {
			_get(TabControl.prototype.__proto__ || Object.getPrototypeOf(TabControl.prototype), "onInstalled", this).apply(this, arguments);
			var me = this;

			me.$element().children().click(function () {
				var prefix = me.uid + "_tab-";
				if (this.id && this.id.startsWith(prefix)) {
					var id = this.id.substring(prefix.length);
					me._setActiveId(id, /* signal = */true);
				}
			});
		}
	}]);

	return TabControl;
}(View);

module.exports = TabControl;

var utils = require("app/utils");

},{"app/utils":51,"app/views/View":63}],63:[function(require,module,exports){
"use strict";

module.exports = View;

var utils = require("app/utils");

// ========================================================

function View() {
	this.visible = true;
	this.uid = this.constructor.name + "-" + View.counter++;

	this._parent = null;
	this.children = [];

	// delegates
	this.onDestroy = new utils.Delegate();

	View.views[this.uid] = this;
}

// @static
View.counter = 1;

// @static
View.views = {};

View.prototype.addChild = function (child) {
	if (child._parent) throw new Error("changing parent currently not supported");
	this.children.push(child);
	child._parent = this;
	// for convenience
	return child;
};

View.prototype.install = function ($parent) {
	var element = utils.createFromHtml(this.getHtml());
	$parent.append(element);
	this.onInstalled($(element), $parent);
};

View.prototype.onInstalled = function ( /* optional */$element, /* optional */$container) {
	if ($element) {
		this._$element = $element;
	} else {
		$element = $("#" + this.uid, $container);
		if (!$element.length) return;
		this._$element = $element;
	}

	if (!this.visible) this._$element[0].style.display = "none";

	// when a view is installed, usually its children are also installed
	var children = utils.Arrays.clone(this.children);
	for (var i = 0, c = children.length; i < c; i++) {
		children[i].onInstalled(undefined, this._$element);
	}
};

View.prototype.$element = function () {
	return this._$element || $([]);
};

View.prototype.getHtml = function () {
	throw new Error("Not implemented in " + this.constructor.name);
};

View.prototype.redraw = function () {
	var $el = this.$element();
	if ($el.length) {
		var el = utils.createFromHtml(this.getHtml());
		$el.replaceWith(el);
		this.onInstalled($(el));
	}
};

/*
Destroy the view and its children recursively, remove all handlers.
This method does not affect view's parent and ancestors.

The caller is responsible to:
  - remove the view from parent's children array
	(use `_removeChild` helper function)
  - remove view's $element from DOM
*/
View.prototype.destroy = function () {
	for (var i = 0, c = this.children.length; i < c; i++) {
		this.children[i].destroy();
	}this.children.length = 0;

	this.onDestroy.trigger();

	// prevent leaks
	this._parent = null;
	this.onDestroy = null;

	// remove from global collection
	delete View.views[this.uid];
};

// @static
View._removeChild = function (parent, child) {
	if (parent == null) throw new Error("Argument is null: parent");
	if (child == null) throw new Error("Argument is null: child");
	var pos = parent.children.indexOf(child);
	if (pos < 0) throw new Error("Could not find child view to remove", "parent", parent.uid, "child", child.uid);else parent.children.splice(pos, 1);
};

// PROPS

View.prototype.setVisible = function (visible) {
	this.visible = visible;

	if (this._$element) {
		if (this.visible) this._$element[0].style.removeProperty("display");else this._$element[0].style.display = "none";
	}
};

View.prototype.toggleVisible = function () {
	return this.setVisible(!this.visible);
};

},{"app/utils":51}],64:[function(require,module,exports){
(function (process,Buffer){
'use strict';

// Generated by CoffeeScript 1.10.0
var Parser, StringDecoder, stream, util;

stream = require('stream');

util = require('util');

StringDecoder = require('string_decoder').StringDecoder;

module.exports = function () {
  var callback, called, chunks, data, options, parser;
  if (arguments.length === 3) {
    data = arguments[0];
    options = arguments[1];
    callback = arguments[2];
    if (typeof callback !== 'function') {
      throw Error("Invalid callback argument: " + JSON.stringify(callback));
    }
    if (!(typeof data === 'string' || Buffer.isBuffer(arguments[0]))) {
      return callback(Error("Invalid data argument: " + JSON.stringify(data)));
    }
  } else if (arguments.length === 2) {
    if (typeof arguments[0] === 'string' || Buffer.isBuffer(arguments[0])) {
      data = arguments[0];
    } else {
      options = arguments[0];
    }
    if (typeof arguments[1] === 'function') {
      callback = arguments[1];
    } else {
      options = arguments[1];
    }
  } else if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      callback = arguments[0];
    } else {
      options = arguments[0];
    }
  }
  if (options == null) {
    options = {};
  }
  parser = new Parser(options);
  if (data != null) {
    process.nextTick(function () {
      parser.write(data);
      return parser.end();
    });
  }
  if (callback) {
    called = false;
    chunks = options.objname ? {} : [];
    parser.on('readable', function () {
      var chunk, results;
      results = [];
      while (chunk = parser.read()) {
        if (options.objname) {
          results.push(chunks[chunk[0]] = chunk[1]);
        } else {
          results.push(chunks.push(chunk));
        }
      }
      return results;
    });
    parser.on('error', function (err) {
      called = true;
      return callback(err);
    });
    parser.on('end', function () {
      if (!called) {
        return callback(null, chunks);
      }
    });
  }
  return parser;
};

Parser = function Parser(options) {
  var base, base1, base10, base11, base12, base13, base14, base15, base16, base2, base3, base4, base5, base6, base7, base8, base9, k, v;
  if (options == null) {
    options = {};
  }
  options.objectMode = true;
  this.options = {};
  for (k in options) {
    v = options[k];
    this.options[k] = v;
  }
  stream.Transform.call(this, this.options);
  if ((base = this.options).rowDelimiter == null) {
    base.rowDelimiter = null;
  }
  if ((base1 = this.options).delimiter == null) {
    base1.delimiter = ',';
  }
  if ((base2 = this.options).quote == null) {
    base2.quote = '"';
  }
  if ((base3 = this.options).escape == null) {
    base3.escape = '"';
  }
  if ((base4 = this.options).columns == null) {
    base4.columns = null;
  }
  if ((base5 = this.options).comment == null) {
    base5.comment = '';
  }
  if ((base6 = this.options).objname == null) {
    base6.objname = false;
  }
  if ((base7 = this.options).trim == null) {
    base7.trim = false;
  }
  if ((base8 = this.options).ltrim == null) {
    base8.ltrim = false;
  }
  if ((base9 = this.options).rtrim == null) {
    base9.rtrim = false;
  }
  if ((base10 = this.options).auto_parse == null) {
    base10.auto_parse = false;
  }
  if ((base11 = this.options).auto_parse_date == null) {
    base11.auto_parse_date = false;
  }
  if ((base12 = this.options).relax == null) {
    base12.relax = false;
  }
  if ((base13 = this.options).relax_column_count == null) {
    base13.relax_column_count = false;
  }
  if ((base14 = this.options).skip_empty_lines == null) {
    base14.skip_empty_lines = false;
  }
  if ((base15 = this.options).max_limit_on_data_read == null) {
    base15.max_limit_on_data_read = 128000;
  }
  if ((base16 = this.options).skip_lines_with_empty_values == null) {
    base16.skip_lines_with_empty_values = false;
  }
  this.lines = 0;
  this.count = 0;
  this.skipped_line_count = 0;
  this.empty_line_count = 0;
  this.is_int = /^(\-|\+)?([1-9]+[0-9]*)$/;
  this.is_float = function (value) {
    return value - parseFloat(value) + 1 >= 0;
  };
  this.decoder = new StringDecoder();
  this.buf = '';
  this.quoting = false;
  this.commenting = false;
  this.field = '';
  this.nextChar = null;
  this.closingQuote = 0;
  this.line = [];
  this.chunks = [];
  this.rawBuf = '';
  return this;
};

util.inherits(Parser, stream.Transform);

module.exports.Parser = Parser;

Parser.prototype._transform = function (chunk, encoding, callback) {
  var err, error;
  if (chunk instanceof Buffer) {
    chunk = this.decoder.write(chunk);
  }
  try {
    this.__write(chunk, false);
    return callback();
  } catch (error) {
    err = error;
    return this.emit('error', err);
  }
};

Parser.prototype._flush = function (callback) {
  var err, error;
  try {
    this.__write(this.decoder.end(), true);
    if (this.quoting) {
      this.emit('error', new Error("Quoted field not terminated at line " + (this.lines + 1)));
      return;
    }
    if (this.line.length > 0) {
      this.__push(this.line);
    }
    return callback();
  } catch (error) {
    err = error;
    return this.emit('error', err);
  }
};

Parser.prototype.__push = function (line) {
  var field, i, j, len, lineAsColumns, rawBuf, row;
  if (this.options.skip_lines_with_empty_values && line.join('').trim() === '') {
    return;
  }
  row = null;
  if (this.options.columns === true) {
    this.options.columns = line;
    rawBuf = '';
    return;
  } else if (typeof this.options.columns === 'function') {
    this.options.columns = this.options.columns(line);
    rawBuf = '';
    return;
  }
  if (!this.line_length && line.length > 0) {
    this.line_length = this.options.columns ? this.options.columns.length : line.length;
  }
  if (line.length === 1 && line[0] === '') {
    this.empty_line_count++;
  } else if (line.length !== this.line_length) {
    if (this.options.relax_column_count) {
      this.skipped_line_count++;
    } else if (this.options.columns != null) {
      throw Error("Number of columns on line " + this.lines + " does not match header");
    } else {
      throw Error("Number of columns is inconsistent on line " + this.lines);
    }
  } else {
    this.count++;
  }
  if (this.options.columns != null) {
    lineAsColumns = {};
    for (i = j = 0, len = line.length; j < len; i = ++j) {
      field = line[i];
      if (this.options.columns[i] === false) {
        continue;
      }
      lineAsColumns[this.options.columns[i]] = field;
    }
    if (this.options.objname) {
      row = [lineAsColumns[this.options.objname], lineAsColumns];
    } else {
      row = lineAsColumns;
    }
  } else {
    row = line;
  }
  if (this.options.raw) {
    this.push({
      raw: this.rawBuf,
      row: row
    });
    return this.rawBuf = '';
  } else {
    return this.push(row);
  }
};

Parser.prototype.__write = function (chars, end, callback) {
  var areNextCharsDelimiter, areNextCharsRowDelimiters, auto_parse, char, escapeIsQuote, i, isDelimiter, isEscape, isNextCharAComment, isQuote, isRowDelimiter, is_float, is_int, l, ltrim, nextCharPos, ref, remainingBuffer, results, rowDelimiter, rowDelimiterLength, rtrim, wasCommenting;
  is_int = function (_this) {
    return function (value) {
      if (typeof _this.is_int === 'function') {
        return _this.is_int(value);
      } else {
        return _this.is_int.test(value);
      }
    };
  }(this);
  is_float = function (_this) {
    return function (value) {
      if (typeof _this.is_float === 'function') {
        return _this.is_float(value);
      } else {
        return _this.is_float.test(value);
      }
    };
  }(this);
  auto_parse = function (_this) {
    return function (value) {
      var m;
      if (_this.options.auto_parse && is_int(_this.field)) {
        _this.field = parseInt(_this.field);
      } else if (_this.options.auto_parse && is_float(_this.field)) {
        _this.field = parseFloat(_this.field);
      } else if (_this.options.auto_parse && _this.options.auto_parse_date) {
        m = Date.parse(_this.field);
        if (!isNaN(m)) {
          _this.field = new Date(m);
        }
      }
      return _this.field;
    };
  }(this);
  ltrim = this.options.trim || this.options.ltrim;
  rtrim = this.options.trim || this.options.rtrim;
  chars = this.buf + chars;
  l = chars.length;
  rowDelimiterLength = this.options.rowDelimiter ? this.options.rowDelimiter.length : 0;
  i = 0;
  if (this.lines === 0 && 0xFEFF === chars.charCodeAt(0)) {
    i++;
  }
  while (i < l) {
    if (!end) {
      remainingBuffer = chars.substr(i, l - i);
      if (!this.commenting && l - i < this.options.comment.length && this.options.comment.substr(0, l - i) === remainingBuffer || this.options.rowDelimiter && l - i < rowDelimiterLength && this.options.rowDelimiter.substr(0, l - i) === remainingBuffer || this.options.rowDelimiter && this.quoting && l - i < this.options.quote.length + rowDelimiterLength && (this.options.quote + this.options.rowDelimiter).substr(0, l - i) === remainingBuffer || l - i <= this.options.delimiter.length && this.options.delimiter.substr(0, l - i) === remainingBuffer || l - i <= this.options.escape.length && this.options.escape.substr(0, l - i) === remainingBuffer) {
        break;
      }
    }
    char = this.nextChar ? this.nextChar : chars.charAt(i);
    this.nextChar = l > i + 1 ? chars.charAt(i + 1) : '';
    if (this.options.raw) {
      this.rawBuf += char;
    }
    if (this.options.rowDelimiter == null) {
      if (!this.quoting && (char === '\n' || char === '\r')) {
        rowDelimiter = char;
        nextCharPos = i + 1;
      } else if (this.nextChar === '\n' || this.nextChar === '\r') {
        rowDelimiter = this.nextChar;
        nextCharPos = i + 2;
        if (this.raw) {
          rawBuf += this.nextChar;
        }
      }
      if (rowDelimiter) {
        if (rowDelimiter === '\r' && chars.charAt(nextCharPos) === '\n') {
          rowDelimiter += '\n';
        }
        this.options.rowDelimiter = rowDelimiter;
        rowDelimiterLength = this.options.rowDelimiter.length;
      }
    }
    if (!this.commenting && char === this.options.escape) {
      escapeIsQuote = this.options.escape === this.options.quote;
      isEscape = this.nextChar === this.options.escape;
      isQuote = this.nextChar === this.options.quote;
      if (!(escapeIsQuote && !this.field && !this.quoting) && (isEscape || isQuote)) {
        i++;
        char = this.nextChar;
        this.nextChar = chars.charAt(i + 1);
        this.field += char;
        if (this.options.raw) {
          this.rawBuf += char;
        }
        i++;
        continue;
      }
    }
    if (!this.commenting && char === this.options.quote) {
      if (this.quoting) {
        areNextCharsRowDelimiters = this.options.rowDelimiter && chars.substr(i + 1, this.options.rowDelimiter.length) === this.options.rowDelimiter;
        areNextCharsDelimiter = chars.substr(i + 1, this.options.delimiter.length) === this.options.delimiter;
        isNextCharAComment = this.nextChar === this.options.comment;
        if (this.nextChar && !areNextCharsRowDelimiters && !areNextCharsDelimiter && !isNextCharAComment) {
          if (this.options.relax) {
            this.quoting = false;
            this.field = "" + this.options.quote + this.field;
          } else {
            throw Error("Invalid closing quote at line " + (this.lines + 1) + "; found " + JSON.stringify(this.nextChar) + " instead of delimiter " + JSON.stringify(this.options.delimiter));
          }
        } else {
          this.quoting = false;
          this.closingQuote = this.options.quote.length;
          i++;
          if (end && i === l) {
            this.line.push(auto_parse(this.field));
            this.field = '';
          }
          continue;
        }
      } else if (!this.field) {
        this.quoting = true;
        i++;
        continue;
      } else if (this.field && !this.options.relax) {
        throw Error("Invalid opening quote at line " + (this.lines + 1));
      }
    }
    isRowDelimiter = this.options.rowDelimiter && chars.substr(i, this.options.rowDelimiter.length) === this.options.rowDelimiter;
    if (isRowDelimiter || end && i === l - 1) {
      this.lines++;
    }
    wasCommenting = false;
    if (!this.commenting && !this.quoting && this.options.comment && chars.substr(i, this.options.comment.length) === this.options.comment) {
      this.commenting = true;
    } else if (this.commenting && isRowDelimiter) {
      wasCommenting = true;
      this.commenting = false;
    }
    isDelimiter = chars.substr(i, this.options.delimiter.length) === this.options.delimiter;
    if (!this.commenting && !this.quoting && (isDelimiter || isRowDelimiter)) {
      if (isRowDelimiter && this.line.length === 0 && this.field === '') {
        if (wasCommenting || this.options.skip_empty_lines) {
          i += this.options.rowDelimiter.length;
          this.nextChar = chars.charAt(i);
          continue;
        }
      }
      if (rtrim) {
        if (!this.closingQuote) {
          this.field = this.field.trimRight();
        }
      }
      this.line.push(auto_parse(this.field));
      this.closingQuote = 0;
      this.field = '';
      if (isDelimiter) {
        i += this.options.delimiter.length;
        this.nextChar = chars.charAt(i);
        if (end && !this.nextChar) {
          isRowDelimiter = true;
          this.line.push('');
        }
      }
      if (isRowDelimiter) {
        this.__push(this.line);
        this.line = [];
        i += (ref = this.options.rowDelimiter) != null ? ref.length : void 0;
        this.nextChar = chars.charAt(i);
        continue;
      }
    } else if (!this.commenting && !this.quoting && (char === ' ' || char === '\t')) {
      if (!(ltrim && !this.field)) {
        this.field += char;
      }
      if (end && i + 1 === l) {
        if (this.options.trim || this.options.rtrim) {
          this.field = this.field.trimRight();
        }
      }
      i++;
    } else if (!this.commenting) {
      this.field += char;
      i++;
    } else {
      i++;
    }
    if (!this.commenting && this.field.length > this.options.max_limit_on_data_read) {
      throw Error("Delimiter not found in the file " + JSON.stringify(this.options.delimiter));
    }
    if (!this.commenting && this.line.length > this.options.max_limit_on_data_read) {
      throw Error("Row delimiter not found in the file " + JSON.stringify(this.options.rowDelimiter));
    }
  }
  if (end) {
    if (rtrim) {
      if (!this.closingQuote) {
        this.field = this.field.trimRight();
      }
    }
    if (this.field !== '') {
      this.line.push(auto_parse(this.field));
      this.field = '';
    }
    if (this.field.length > this.options.max_limit_on_data_read) {
      throw Error("Delimiter not found in the file " + JSON.stringify(this.options.delimiter));
    }
    if (l === 0) {
      this.lines++;
    }
    if (this.line.length > this.options.max_limit_on_data_read) {
      throw Error("Row delimiter not found in the file " + JSON.stringify(this.options.rowDelimiter));
    }
  }
  this.buf = '';
  results = [];
  while (i < l) {
    this.buf += chars.charAt(i);
    results.push(i++);
  }
  return results;
};

}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":9,"buffer":2,"stream":26,"string_decoder":27,"util":30}],65:[function(require,module,exports){
"use strict";

(function () {

  var fnNameMatchRegex = /^\s*function\s+([^\(\s]*)\s*/;

  function _name() {
    var match, name;
    if (this === Function || this === Function.prototype.constructor) {
      name = "Function";
    } else if (this !== Function.prototype) {
      match = ("" + this).match(fnNameMatchRegex);
      name = match && match[1];
    }
    return name || "";
  }

  // Inspect the polyfill-ability of this browser
  var needsPolyfill = !("name" in Function.prototype && "name" in function x() {});
  var canDefineProp = typeof Object.defineProperty === "function" && function () {
    var result;
    try {
      Object.defineProperty(Function.prototype, "_xyz", {
        get: function get() {
          return "blah";
        },
        configurable: true
      });
      result = Function.prototype._xyz === "blah";
      delete Function.prototype._xyz;
    } catch (e) {
      result = false;
    }
    return result;
  }();
  var canDefineGetter = typeof Object.prototype.__defineGetter__ === "function" && function () {
    var result;
    try {
      Function.prototype.__defineGetter__("_abc", function () {
        return "foo";
      });
      result = Function.prototype._abc === "foo";
      delete Function.prototype._abc;
    } catch (e) {
      result = false;
    }
    return result;
  }();

  // Add the "private" property for testing, even if the real property can be polyfilled
  Function.prototype._name = _name;

  // Polyfill it!
  // For:
  //  * IE >=9 <12
  //  * Chrome <33
  if (needsPolyfill) {
    // For:
    //  * IE >=9 <12
    //  * Chrome >=5 <33
    if (canDefineProp) {
      Object.defineProperty(Function.prototype, "name", {
        get: function get() {
          var name = _name.call(this);

          // Since named function definitions have immutable names, also memoize the
          // output by defining the `name` property directly on this Function
          // instance so that this polyfill will not need to be invoked again
          if (this !== Function.prototype) {
            Object.defineProperty(this, "name", {
              value: name,
              configurable: true
            });
          }

          return name;
        },
        configurable: true
      });
    }
    // For:
    //  * Chrome <5
    else if (canDefineGetter) {
        // NOTE:
        // The snippet:
        //
        //     x.__defineGetter__('y', z);
        //
        // ...is essentially equivalent to:
        //
        //     Object.defineProperty(x, 'y', {
        //       get: z,
        //       configurable: true,  // <-- key difference #1
        //       enumerable: true     // <-- key difference #2
        //     });
        //
        Function.prototype.__defineGetter__("name", function () {
          var name = _name.call(this);

          // Since named function definitions have immutable names, also memoize the
          // output by defining the `name` property directly on this Function
          // instance so that this polyfill will not need to be invoked again
          if (this !== Function.prototype) {
            this.__defineGetter__("name", function () {
              return name;
            });
          }

          return name;
        });
      }
  }
})();

},{}]},{},[36])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9kdXBsZXguanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fZHVwbGV4LmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3JlYWRhYmxlLmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3RyYW5zZm9ybS5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV93cml0YWJsZS5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvaW50ZXJuYWwvc3RyZWFtcy9CdWZmZXJMaXN0LmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL25vZGVfbW9kdWxlcy9idWZmZXItc2hpbXMvaW5kZXguanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL2NvcmUtdXRpbC1pcy9saWIvdXRpbC5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9ub2RlX21vZHVsZXMvcHJvY2Vzcy1uZXh0aWNrLWFyZ3MvaW5kZXguanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL3V0aWwtZGVwcmVjYXRlL2Jyb3dzZXIuanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcmVhZGFibGUuanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3dyaXRhYmxlLmpzIiwiLi4vLi4vQ29ucy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvc3RyZWFtLWJyb3dzZXJpZnkvaW5kZXguanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9zdHJpbmdfZGVjb2Rlci9pbmRleC5qcyIsIi4uLy4uL0NvbnMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvc3VwcG9ydC9pc0J1ZmZlckJyb3dzZXIuanMiLCIuLi8uLi9Db25zL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3V0aWwuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcQWpheExvYWRlci5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxGaWxlTG9hZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXExvYWRDb250cm9sbGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXFN0cmluZ3MuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcZXhjZXB0aW9uc1xcQ3N2RXJyb3IuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcbWFpbi5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxtb2RlbFxcTW9kZWwuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcbW9kZWxcXE1vZGVsQ2xhc3Nlcy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxtb2RlbFxcUmVjb3JkU2VsZWN0aW9uTW9kZWwuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcbW9kZWxcXFNlYXJjaE1vZGVsLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxTcWxNb2RlbC5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxtb2RlbFxccmVhZGVyc1xcQXBhcnRtZW50c1dpdGhvdXRTZWN0aW9uUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxyZWFkZXJzXFxCYXNlQ3N2UmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxyZWFkZXJzXFxJbmNvcnJlY3RBcGFydG1lbnRzUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxyZWFkZXJzXFxKdXJpZGljYWxQZXJzb25zUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxyZWFkZXJzXFxPbGRBcGFydG1lbnROdW1iZXJzUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXG1vZGVsXFxyZWFkZXJzXFxPd25lcnNSZWdpc3RyeVJlYWRlci5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxtb2RlbFxccmVhZGVyc1xcUGFyc2luZy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFxtb2RlbFxccmVhZGVyc1xcUGFydGljaXBhbnRzUmVnaXN0cnlSZWFkZXIuanMiLCJub2RlX21vZHVsZXNcXGFwcFxccG9seWZpbGxzLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXHV0aWxzLmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXHZpZXdzXFxEYXRhVmlldy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcR3JpZC5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcR3JpZFZpZXcuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcdmlld3NcXEluY29tcGF0aWJsZUJyb3dzZXJWaWV3LmpzIiwibm9kZV9tb2R1bGVzXFxhcHBcXHZpZXdzXFxNYWluVmlldy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcT2JqZWN0UG9wdXAuanMiLCJub2RlX21vZHVsZXNcXGFwcFxcdmlld3NcXFBvcHVwTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcUmVjb3JkSW5mby5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcU2VhcmNoVmlldy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcU3FsVmlldy5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcVGFiQ29udHJvbC5qcyIsIm5vZGVfbW9kdWxlc1xcYXBwXFx2aWV3c1xcVmlldy5qcyIsIm5vZGVfbW9kdWxlc1xcY3N2LXBhcnNlXFxsaWJcXG5vZGVfbW9kdWxlc1xcY3N2LXBhcnNlXFxsaWJcXGluZGV4LmpzIiwibm9kZV9tb2R1bGVzXFxmdW5jdGlvbi5uYW1lLXBvbHlmaWxsXFxGdW5jdGlvbi5uYW1lLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3dkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4NkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN2dCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25FQTtBQUNBOzs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEJBO0FBQ0E7O0FDREE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0lDMWtCTSxVOzs7Ozs7O3VCQUNBLFEs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O0FBaEJrQyxPQUFsRDtBQWtCRDtBQUNEO0FBQ0E7QUFyQkEsU0FzQkssSUFBSSxlQUFKLEVBQXFCO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQVMsU0FBVCxDQUFtQixnQkFBbkIsQ0FBb0MsTUFBcEMsRUFBNEMsWUFBVztBQUNyRCxjQUFJLE9BQU8sTUFBTSxJQUFOLENBQVcsSUFBWCxDQUFYOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGNBQUksU0FBUyxTQUFTLFNBQXRCLEVBQWlDO0FBQy9CLGlCQUFLLGdCQUFMLENBQXNCLE1BQXRCLEVBQThCLFlBQVc7QUFBRSxxQkFBTyxJQUFQO0FBQWMsYUFBekQ7QUFDRDs7QUFFRCxpQkFBTyxJQUFQO0FBQ0QsU0FYRDtBQVlEO0FBQ0Y7QUFFQSxDQXJIRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIiLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuLypcbiAqIEV4cG9ydCBrTWF4TGVuZ3RoIGFmdGVyIHR5cGVkIGFycmF5IHN1cHBvcnQgaXMgZGV0ZXJtaW5lZC5cbiAqL1xuZXhwb3J0cy5rTWF4TGVuZ3RoID0ga01heExlbmd0aCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuX19wcm90b19fID0ge19fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfX1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG5mdW5jdGlvbiBjcmVhdGVCdWZmZXIgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoa01heExlbmd0aCgpIDwgbGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgdHlwZWQgYXJyYXkgbGVuZ3RoJylcbiAgfVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICBpZiAodGhhdCA9PT0gbnVsbCkge1xuICAgICAgdGhhdCA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICAgIH1cbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuXG5mdW5jdGlvbiBCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0lmIGVuY29kaW5nIGlzIHNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJ1xuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NVbnNhZmUodGhpcywgYXJnKVxuICB9XG4gIHJldHVybiBmcm9tKHRoaXMsIGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxuLy8gVE9ETzogTGVnYWN5LCBub3QgbmVlZGVkIGFueW1vcmUuIFJlbW92ZSBpbiBuZXh0IG1ham9yIHZlcnNpb24uXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gZnJvbSAodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoYXQsIHZhbHVlKVxufVxuXG4vKipcbiAqIEZ1bmN0aW9uYWxseSBlcXVpdmFsZW50IHRvIEJ1ZmZlcihhcmcsIGVuY29kaW5nKSBidXQgdGhyb3dzIGEgVHlwZUVycm9yXG4gKiBpZiB2YWx1ZSBpcyBhIG51bWJlci5cbiAqIEJ1ZmZlci5mcm9tKHN0clssIGVuY29kaW5nXSlcbiAqIEJ1ZmZlci5mcm9tKGFycmF5KVxuICogQnVmZmVyLmZyb20oYnVmZmVyKVxuICogQnVmZmVyLmZyb20oYXJyYXlCdWZmZXJbLCBieXRlT2Zmc2V0WywgbGVuZ3RoXV0pXG4gKiovXG5CdWZmZXIuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBmcm9tKG51bGwsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG4gIGlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuc3BlY2llcyAmJlxuICAgICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gICAgLy8gRml4IHN1YmFycmF5KCkgaW4gRVMyMDE2LiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvOTdcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgICAgdmFsdWU6IG51bGwsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFNpemUgKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3QgYmUgYSBudW1iZXInKVxuICB9IGVsc2UgaWYgKHNpemUgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIG5lZ2F0aXZlJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAodGhhdCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2MobnVsbCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlICh0aGF0LCBzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2l6ZTsgKytpKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJlbmNvZGluZ1wiIG11c3QgYmUgYSB2YWxpZCBzdHJpbmcgZW5jb2RpbmcnKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuZ3RoKVxuXG4gIHZhciBhY3R1YWwgPSB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG5cbiAgaWYgKGFjdHVhbCAhPT0gbGVuZ3RoKSB7XG4gICAgLy8gV3JpdGluZyBhIGhleCBzdHJpbmcsIGZvciBleGFtcGxlLCB0aGF0IGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycyB3aWxsXG4gICAgLy8gY2F1c2UgZXZlcnl0aGluZyBhZnRlciB0aGUgZmlyc3QgaW52YWxpZCBjaGFyYWN0ZXIgdG8gYmUgaWdub3JlZC4gKGUuZy5cbiAgICAvLyAnYWJ4eGNkJyB3aWxsIGJlIHRyZWF0ZWQgYXMgJ2FiJylcbiAgICB0aGF0ID0gdGhhdC5zbGljZSgwLCBhY3R1YWwpXG4gIH1cblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGFycmF5LmJ5dGVMZW5ndGggLy8gdGhpcyB0aHJvd3MgaWYgYGFycmF5YCBpcyBub3QgYSB2YWxpZCBBcnJheUJ1ZmZlclxuXG4gIGlmIChieXRlT2Zmc2V0IDwgMCB8fCBhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcXCdvZmZzZXRcXCcgaXMgb3V0IG9mIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQgKyAobGVuZ3RoIHx8IDApKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ2xlbmd0aFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldClcbiAgfSBlbHNlIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gYXJyYXlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21BcnJheUxpa2UodGhhdCwgYXJyYXkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuKVxuXG4gICAgaWYgKHRoYXQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhhdFxuICAgIH1cblxuICAgIG9iai5jb3B5KHRoYXQsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gdGhhdFxuICB9XG5cbiAgaWYgKG9iaikge1xuICAgIGlmICgodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICBvYmouYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHx8ICdsZW5ndGgnIGluIG9iaikge1xuICAgICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBpc25hbihvYmoubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIDApXG4gICAgICB9XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmopXG4gICAgfVxuXG4gICAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iai5kYXRhKSkge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqLmRhdGEpXG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZywgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQXJyYXksIG9yIGFycmF5LWxpa2Ugb2JqZWN0LicpXG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoKClgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnbGF0aW4xJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYygwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgYnVmID0gbGlzdFtpXVxuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gICAgfVxuICAgIGJ1Zi5jb3B5KGJ1ZmZlciwgcG9zKVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIEFycmF5QnVmZmVyLmlzVmlldyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgKEFycmF5QnVmZmVyLmlzVmlldyhzdHJpbmcpIHx8IHN0cmluZyBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoZSBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIGFuZCBgaXMtYnVmZmVyYCAoaW4gU2FmYXJpIDUtNykgdG8gZGV0ZWN0XG4vLyBCdWZmZXIgaW5zdGFuY2VzLlxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwNjQgPSBmdW5jdGlvbiBzd2FwNjQgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDggIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDY0LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDgpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyA3KVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyA2KVxuICAgIHN3YXAodGhpcywgaSArIDIsIGkgKyA1KVxuICAgIHN3YXAodGhpcywgaSArIDMsIGkgKyA0KVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlICh0YXJnZXQsIHN0YXJ0LCBlbmQsIHRoaXNTdGFydCwgdGhpc0VuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIH1cblxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuZCA9IHRhcmdldCA/IHRhcmdldC5sZW5ndGggOiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc1N0YXJ0ID0gMFxuICB9XG4gIGlmICh0aGlzRW5kID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzRW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChzdGFydCA8IDAgfHwgZW5kID4gdGFyZ2V0Lmxlbmd0aCB8fCB0aGlzU3RhcnQgPCAwIHx8IHRoaXNFbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kICYmIHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kKSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cbiAgaWYgKHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAxXG4gIH1cblxuICBzdGFydCA+Pj49IDBcbiAgZW5kID4+Pj0gMFxuICB0aGlzU3RhcnQgPj4+PSAwXG4gIHRoaXNFbmQgPj4+PSAwXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCkgcmV0dXJuIDBcblxuICB2YXIgeCA9IHRoaXNFbmQgLSB0aGlzU3RhcnRcbiAgdmFyIHkgPSBlbmQgLSBzdGFydFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcblxuICB2YXIgdGhpc0NvcHkgPSB0aGlzLnNsaWNlKHRoaXNTdGFydCwgdGhpc0VuZClcbiAgdmFyIHRhcmdldENvcHkgPSB0YXJnZXQuc2xpY2Uoc3RhcnQsIGVuZClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKHRoaXNDb3B5W2ldICE9PSB0YXJnZXRDb3B5W2ldKSB7XG4gICAgICB4ID0gdGhpc0NvcHlbaV1cbiAgICAgIHkgPSB0YXJnZXRDb3B5W2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuLy8gRmluZHMgZWl0aGVyIHRoZSBmaXJzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPj0gYGJ5dGVPZmZzZXRgLFxuLy8gT1IgdGhlIGxhc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0IDw9IGBieXRlT2Zmc2V0YC5cbi8vXG4vLyBBcmd1bWVudHM6XG4vLyAtIGJ1ZmZlciAtIGEgQnVmZmVyIHRvIHNlYXJjaFxuLy8gLSB2YWwgLSBhIHN0cmluZywgQnVmZmVyLCBvciBudW1iZXJcbi8vIC0gYnl0ZU9mZnNldCAtIGFuIGluZGV4IGludG8gYGJ1ZmZlcmA7IHdpbGwgYmUgY2xhbXBlZCB0byBhbiBpbnQzMlxuLy8gLSBlbmNvZGluZyAtIGFuIG9wdGlvbmFsIGVuY29kaW5nLCByZWxldmFudCBpcyB2YWwgaXMgYSBzdHJpbmdcbi8vIC0gZGlyIC0gdHJ1ZSBmb3IgaW5kZXhPZiwgZmFsc2UgZm9yIGxhc3RJbmRleE9mXG5mdW5jdGlvbiBiaWRpcmVjdGlvbmFsSW5kZXhPZiAoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgLy8gRW1wdHkgYnVmZmVyIG1lYW5zIG5vIG1hdGNoXG4gIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldFxuICBpZiAodHlwZW9mIGJ5dGVPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBieXRlT2Zmc2V0XG4gICAgYnl0ZU9mZnNldCA9IDBcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikge1xuICAgIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSB7XG4gICAgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIH1cbiAgYnl0ZU9mZnNldCA9ICtieXRlT2Zmc2V0ICAvLyBDb2VyY2UgdG8gTnVtYmVyLlxuICBpZiAoaXNOYU4oYnl0ZU9mZnNldCkpIHtcbiAgICAvLyBieXRlT2Zmc2V0OiBpdCBpdCdzIHVuZGVmaW5lZCwgbnVsbCwgTmFOLCBcImZvb1wiLCBldGMsIHNlYXJjaCB3aG9sZSBidWZmZXJcbiAgICBieXRlT2Zmc2V0ID0gZGlyID8gMCA6IChidWZmZXIubGVuZ3RoIC0gMSlcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0OiBuZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggKyBieXRlT2Zmc2V0XG4gIGlmIChieXRlT2Zmc2V0ID49IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICBpZiAoZGlyKSByZXR1cm4gLTFcbiAgICBlbHNlIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoIC0gMVxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAwKSB7XG4gICAgaWYgKGRpcikgYnl0ZU9mZnNldCA9IDBcbiAgICBlbHNlIHJldHVybiAtMVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIHZhbFxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWwgPSBCdWZmZXIuZnJvbSh2YWwsIGVuY29kaW5nKVxuICB9XG5cbiAgLy8gRmluYWxseSwgc2VhcmNoIGVpdGhlciBpbmRleE9mIChpZiBkaXIgaXMgdHJ1ZSkgb3IgbGFzdEluZGV4T2ZcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgLy8gU3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcvYnVmZmVyIGFsd2F5cyBmYWlsc1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDB4RkYgLy8gU2VhcmNoIGZvciBhIGJ5dGUgdmFsdWUgWzAtMjU1XVxuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJlxuICAgICAgICB0eXBlb2YgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKGRpcikge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmxhc3RJbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCBbIHZhbCBdLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICB2YXIgaW5kZXhTaXplID0gMVxuICB2YXIgYXJyTGVuZ3RoID0gYXJyLmxlbmd0aFxuICB2YXIgdmFsTGVuZ3RoID0gdmFsLmxlbmd0aFxuXG4gIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICBpZiAoZW5jb2RpbmcgPT09ICd1Y3MyJyB8fCBlbmNvZGluZyA9PT0gJ3Vjcy0yJyB8fFxuICAgICAgICBlbmNvZGluZyA9PT0gJ3V0ZjE2bGUnIHx8IGVuY29kaW5nID09PSAndXRmLTE2bGUnKSB7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA8IDIgfHwgdmFsLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIC0xXG4gICAgICB9XG4gICAgICBpbmRleFNpemUgPSAyXG4gICAgICBhcnJMZW5ndGggLz0gMlxuICAgICAgdmFsTGVuZ3RoIC89IDJcbiAgICAgIGJ5dGVPZmZzZXQgLz0gMlxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGJ1ZiwgaSkge1xuICAgIGlmIChpbmRleFNpemUgPT09IDEpIHtcbiAgICAgIHJldHVybiBidWZbaV1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGJ1Zi5yZWFkVUludDE2QkUoaSAqIGluZGV4U2l6ZSlcbiAgICB9XG4gIH1cblxuICB2YXIgaVxuICBpZiAoZGlyKSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPCBhcnJMZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHJlYWQoYXJyLCBpKSA9PT0gcmVhZCh2YWwsIGZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4KSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbExlbmd0aCkgcmV0dXJuIGZvdW5kSW5kZXggKiBpbmRleFNpemVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ICE9PSAtMSkgaSAtPSBpIC0gZm91bmRJbmRleFxuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJ5dGVPZmZzZXQgKyB2YWxMZW5ndGggPiBhcnJMZW5ndGgpIGJ5dGVPZmZzZXQgPSBhcnJMZW5ndGggLSB2YWxMZW5ndGhcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIGZvdW5kID0gdHJ1ZVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB2YWxMZW5ndGg7IGorKykge1xuICAgICAgICBpZiAocmVhZChhcnIsIGkgKyBqKSAhPT0gcmVhZCh2YWwsIGopKSB7XG4gICAgICAgICAgZm91bmQgPSBmYWxzZVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmNsdWRlcyA9IGZ1bmN0aW9uIGluY2x1ZGVzICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiB0aGlzLmluZGV4T2YodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykgIT09IC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIHRydWUpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUubGFzdEluZGV4T2YgPSBmdW5jdGlvbiBsYXN0SW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZmFsc2UpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBsYXRpbjFXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gbGF0aW4xU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47ICsraSkge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgKytpKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7ICsraSkge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSArIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBVc2FnZTpcbi8vICAgIGJ1ZmZlci5maWxsKG51bWJlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoYnVmZmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChzdHJpbmdbLCBvZmZzZXRbLCBlbmRdXVssIGVuY29kaW5nXSlcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbCwgc3RhcnQsIGVuZCwgZW5jb2RpbmcpIHtcbiAgLy8gSGFuZGxlIHN0cmluZyBjYXNlczpcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gc3RhcnRcbiAgICAgIHN0YXJ0ID0gMFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuZFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHZhciBjb2RlID0gdmFsLmNoYXJDb2RlQXQoMClcbiAgICAgIGlmIChjb2RlIDwgMjU2KSB7XG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5jb2RpbmcgbXVzdCBiZSBhIHN0cmluZycpXG4gICAgfVxuICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiB1dGY4VG9CeXRlcyhuZXcgQnVmZmVyKHZhbCwgZW5jb2RpbmcpLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGlzbmFuICh2YWwpIHtcbiAgcmV0dXJuIHZhbCAhPT0gdmFsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG4iLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbnZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5mb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxufVxuXG5yZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbnJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG5mdW5jdGlvbiBwbGFjZUhvbGRlcnNDb3VudCAoYjY0KSB7XG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICByZXR1cm4gYjY0W2xlbiAtIDJdID09PSAnPScgPyAyIDogYjY0W2xlbiAtIDFdID09PSAnPScgPyAxIDogMFxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChiNjQpIHtcbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIHJldHVybiBiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnNDb3VudChiNjQpXG59XG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcbiAgcGxhY2VIb2xkZXJzID0gcGxhY2VIb2xkZXJzQ291bnQoYjY0KVxuXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcgKyBlciArICcpJyk7XG4gICAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvKiFcbiAqIERldGVybWluZSBpZiBhbiBvYmplY3QgaXMgYSBCdWZmZXJcbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG4vLyBUaGUgX2lzQnVmZmVyIGNoZWNrIGlzIGZvciBTYWZhcmkgNS03IHN1cHBvcnQsIGJlY2F1c2UgaXQncyBtaXNzaW5nXG4vLyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yLiBSZW1vdmUgdGhpcyBldmVudHVhbGx5XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPSBudWxsICYmIChpc0J1ZmZlcihvYmopIHx8IGlzU2xvd0J1ZmZlcihvYmopIHx8ICEhb2JqLl9pc0J1ZmZlcilcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKG9iaikge1xuICByZXR1cm4gISFvYmouY29uc3RydWN0b3IgJiYgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKVxufVxuXG4vLyBGb3IgTm9kZSB2MC4xMCBzdXBwb3J0LiBSZW1vdmUgdGhpcyBldmVudHVhbGx5LlxuZnVuY3Rpb24gaXNTbG93QnVmZmVyIChvYmopIHtcbiAgcmV0dXJuIHR5cGVvZiBvYmoucmVhZEZsb2F0TEUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG9iai5zbGljZSA9PT0gJ2Z1bmN0aW9uJyAmJiBpc0J1ZmZlcihvYmouc2xpY2UoMCwgMCkpXG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV9kdXBsZXguanNcIilcbiIsIi8vIGEgZHVwbGV4IHN0cmVhbSBpcyBqdXN0IGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUuXG4vLyBTaW5jZSBKUyBkb2Vzbid0IGhhdmUgbXVsdGlwbGUgcHJvdG90eXBhbCBpbmhlcml0YW5jZSwgdGhpcyBjbGFzc1xuLy8gcHJvdG90eXBhbGx5IGluaGVyaXRzIGZyb20gUmVhZGFibGUsIGFuZCB0aGVuIHBhcmFzaXRpY2FsbHkgZnJvbVxuLy8gV3JpdGFibGUuXG5cbid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBrZXlzLnB1c2goa2V5KTtcbiAgfXJldHVybiBrZXlzO1xufTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5tb2R1bGUuZXhwb3J0cyA9IER1cGxleDtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBwcm9jZXNzTmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzLW5leHRpY2stYXJncycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxudmFyIGtleXMgPSBvYmplY3RLZXlzKFdyaXRhYmxlLnByb3RvdHlwZSk7XG5mb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgdmFyIG1ldGhvZCA9IGtleXNbdl07XG4gIGlmICghRHVwbGV4LnByb3RvdHlwZVttZXRob2RdKSBEdXBsZXgucHJvdG90eXBlW21ldGhvZF0gPSBXcml0YWJsZS5wcm90b3R5cGVbbWV0aG9kXTtcbn1cblxuZnVuY3Rpb24gRHVwbGV4KG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpIHJldHVybiBuZXcgRHVwbGV4KG9wdGlvbnMpO1xuXG4gIFJlYWRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gIFdyaXRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yZWFkYWJsZSA9PT0gZmFsc2UpIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSkgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXG4gIHRoaXMuYWxsb3dIYWxmT3BlbiA9IHRydWU7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dIYWxmT3BlbiA9PT0gZmFsc2UpIHRoaXMuYWxsb3dIYWxmT3BlbiA9IGZhbHNlO1xuXG4gIHRoaXMub25jZSgnZW5kJywgb25lbmQpO1xufVxuXG4vLyB0aGUgbm8taGFsZi1vcGVuIGVuZm9yY2VyXG5mdW5jdGlvbiBvbmVuZCgpIHtcbiAgLy8gaWYgd2UgYWxsb3cgaGFsZi1vcGVuIHN0YXRlLCBvciBpZiB0aGUgd3JpdGFibGUgc2lkZSBlbmRlZCxcbiAgLy8gdGhlbiB3ZSdyZSBvay5cbiAgaWYgKHRoaXMuYWxsb3dIYWxmT3BlbiB8fCB0aGlzLl93cml0YWJsZVN0YXRlLmVuZGVkKSByZXR1cm47XG5cbiAgLy8gbm8gbW9yZSBkYXRhIGNhbiBiZSB3cml0dGVuLlxuICAvLyBCdXQgYWxsb3cgbW9yZSB3cml0ZXMgdG8gaGFwcGVuIGluIHRoaXMgdGljay5cbiAgcHJvY2Vzc05leHRUaWNrKG9uRW5kTlQsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBvbkVuZE5UKHNlbGYpIHtcbiAgc2VsZi5lbmQoKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCh4cywgZikge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGYoeHNbaV0sIGkpO1xuICB9XG59IiwiLy8gYSBwYXNzdGhyb3VnaCBzdHJlYW0uXG4vLyBiYXNpY2FsbHkganVzdCB0aGUgbW9zdCBtaW5pbWFsIHNvcnQgb2YgVHJhbnNmb3JtIHN0cmVhbS5cbi8vIEV2ZXJ5IHdyaXR0ZW4gY2h1bmsgZ2V0cyBvdXRwdXQgYXMtaXMuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQYXNzVGhyb3VnaDtcblxudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vX3N0cmVhbV90cmFuc2Zvcm0nKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFBhc3NUaHJvdWdoLCBUcmFuc2Zvcm0pO1xuXG5mdW5jdGlvbiBQYXNzVGhyb3VnaChvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQYXNzVGhyb3VnaCkpIHJldHVybiBuZXcgUGFzc1Rocm91Z2gob3B0aW9ucyk7XG5cbiAgVHJhbnNmb3JtLmNhbGwodGhpcywgb3B0aW9ucyk7XG59XG5cblBhc3NUaHJvdWdoLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24gKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobnVsbCwgY2h1bmspO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhZGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5Jyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuUmVhZGFibGUuUmVhZGFibGVTdGF0ZSA9IFJlYWRhYmxlU3RhdGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbnZhciBFRWxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbiAoZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lcnModHlwZSkubGVuZ3RoO1xufTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgU3RyZWFtID0gcmVxdWlyZSgnc3QnICsgJ3JlYW0nKTtcbiAgfSBjYXRjaCAoXykge30gZmluYWxseSB7XG4gICAgaWYgKCFTdHJlYW0pIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbiAgfVxufSkoKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBidWZmZXJTaGltID0gcmVxdWlyZSgnYnVmZmVyLXNoaW1zJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGRlYnVnVXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcbnZhciBkZWJ1ZyA9IHZvaWQgMDtcbmlmIChkZWJ1Z1V0aWwgJiYgZGVidWdVdGlsLmRlYnVnbG9nKSB7XG4gIGRlYnVnID0gZGVidWdVdGlsLmRlYnVnbG9nKCdzdHJlYW0nKTtcbn0gZWxzZSB7XG4gIGRlYnVnID0gZnVuY3Rpb24gKCkge307XG59XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlckxpc3QgPSByZXF1aXJlKCcuL2ludGVybmFsL3N0cmVhbXMvQnVmZmVyTGlzdCcpO1xudmFyIFN0cmluZ0RlY29kZXI7XG5cbnV0aWwuaW5oZXJpdHMoUmVhZGFibGUsIFN0cmVhbSk7XG5cbmZ1bmN0aW9uIHByZXBlbmRMaXN0ZW5lcihlbWl0dGVyLCBldmVudCwgZm4pIHtcbiAgaWYgKHR5cGVvZiBlbWl0dGVyLnByZXBlbmRMaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBlbWl0dGVyLnByZXBlbmRMaXN0ZW5lcihldmVudCwgZm4pO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoaXMgaXMgYSBoYWNrIHRvIG1ha2Ugc3VyZSB0aGF0IG91ciBlcnJvciBoYW5kbGVyIGlzIGF0dGFjaGVkIGJlZm9yZSBhbnlcbiAgICAvLyB1c2VybGFuZCBvbmVzLiAgTkVWRVIgRE8gVEhJUy4gVGhpcyBpcyBoZXJlIG9ubHkgYmVjYXVzZSB0aGlzIGNvZGUgbmVlZHNcbiAgICAvLyB0byBjb250aW51ZSB0byB3b3JrIHdpdGggb2xkZXIgdmVyc2lvbnMgb2YgTm9kZS5qcyB0aGF0IGRvIG5vdCBpbmNsdWRlXG4gICAgLy8gdGhlIHByZXBlbmRMaXN0ZW5lcigpIG1ldGhvZC4gVGhlIGdvYWwgaXMgdG8gZXZlbnR1YWxseSByZW1vdmUgdGhpcyBoYWNrLlxuICAgIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbZXZlbnRdKSBlbWl0dGVyLm9uKGV2ZW50LCBmbik7ZWxzZSBpZiAoaXNBcnJheShlbWl0dGVyLl9ldmVudHNbZXZlbnRdKSkgZW1pdHRlci5fZXZlbnRzW2V2ZW50XS51bnNoaWZ0KGZuKTtlbHNlIGVtaXR0ZXIuX2V2ZW50c1tldmVudF0gPSBbZm4sIGVtaXR0ZXIuX2V2ZW50c1tldmVudF1dO1xuICB9XG59XG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHN0cmVhbSkge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIG9iamVjdCBzdHJlYW0gZmxhZy4gVXNlZCB0byBtYWtlIHJlYWQobikgaWdub3JlIG4gYW5kIHRvXG4gIC8vIG1ha2UgYWxsIHRoZSBidWZmZXIgbWVyZ2luZyBhbmQgbGVuZ3RoIGNoZWNrcyBnbyBhd2F5XG4gIHRoaXMub2JqZWN0TW9kZSA9ICEhb3B0aW9ucy5vYmplY3RNb2RlO1xuXG4gIGlmIChzdHJlYW0gaW5zdGFuY2VvZiBEdXBsZXgpIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMucmVhZGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCBpdCBzdG9wcyBjYWxsaW5nIF9yZWFkKCkgdG8gZmlsbCB0aGUgYnVmZmVyXG4gIC8vIE5vdGU6IDAgaXMgYSB2YWxpZCB2YWx1ZSwgbWVhbnMgXCJkb24ndCBjYWxsIF9yZWFkIHByZWVtcHRpdmVseSBldmVyXCJcbiAgdmFyIGh3bSA9IG9wdGlvbnMuaGlnaFdhdGVyTWFyaztcbiAgdmFyIGRlZmF1bHRId20gPSB0aGlzLm9iamVjdE1vZGUgPyAxNiA6IDE2ICogMTAyNDtcbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gaHdtIHx8IGh3bSA9PT0gMCA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gY2FzdCB0byBpbnRzLlxuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSB+IH50aGlzLmhpZ2hXYXRlck1hcms7XG5cbiAgLy8gQSBsaW5rZWQgbGlzdCBpcyB1c2VkIHRvIHN0b3JlIGRhdGEgY2h1bmtzIGluc3RlYWQgb2YgYW4gYXJyYXkgYmVjYXVzZSB0aGVcbiAgLy8gbGlua2VkIGxpc3QgY2FuIHJlbW92ZSBlbGVtZW50cyBmcm9tIHRoZSBiZWdpbm5pbmcgZmFzdGVyIHRoYW5cbiAgLy8gYXJyYXkuc2hpZnQoKVxuICB0aGlzLmJ1ZmZlciA9IG5ldyBCdWZmZXJMaXN0KCk7XG4gIHRoaXMubGVuZ3RoID0gMDtcbiAgdGhpcy5waXBlcyA9IG51bGw7XG4gIHRoaXMucGlwZXNDb3VudCA9IDA7XG4gIHRoaXMuZmxvd2luZyA9IG51bGw7XG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgdGhpcy5lbmRFbWl0dGVkID0gZmFsc2U7XG4gIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIHdoZW5ldmVyIHdlIHJldHVybiBudWxsLCB0aGVuIHdlIHNldCBhIGZsYWcgdG8gc2F5XG4gIC8vIHRoYXQgd2UncmUgYXdhaXRpbmcgYSAncmVhZGFibGUnIGV2ZW50IGVtaXNzaW9uLlxuICB0aGlzLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLnJlYWRhYmxlTGlzdGVuaW5nID0gZmFsc2U7XG4gIHRoaXMucmVzdW1lU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gd2hlbiBwaXBpbmcsIHdlIG9ubHkgY2FyZSBhYm91dCAncmVhZGFibGUnIGV2ZW50cyB0aGF0IGhhcHBlblxuICAvLyBhZnRlciByZWFkKClpbmcgYWxsIHRoZSBieXRlcyBhbmQgbm90IGdldHRpbmcgYW55IHB1c2hiYWNrLlxuICB0aGlzLnJhbk91dCA9IGZhbHNlO1xuXG4gIC8vIHRoZSBudW1iZXIgb2Ygd3JpdGVycyB0aGF0IGFyZSBhd2FpdGluZyBhIGRyYWluIGV2ZW50IGluIC5waXBlKClzXG4gIHRoaXMuYXdhaXREcmFpbiA9IDA7XG5cbiAgLy8gaWYgdHJ1ZSwgYSBtYXliZVJlYWRNb3JlIGhhcyBiZWVuIHNjaGVkdWxlZFxuICB0aGlzLnJlYWRpbmdNb3JlID0gZmFsc2U7XG5cbiAgdGhpcy5kZWNvZGVyID0gbnVsbDtcbiAgdGhpcy5lbmNvZGluZyA9IG51bGw7XG4gIGlmIChvcHRpb25zLmVuY29kaW5nKSB7XG4gICAgaWYgKCFTdHJpbmdEZWNvZGVyKSBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgICB0aGlzLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihvcHRpb25zLmVuY29kaW5nKTtcbiAgICB0aGlzLmVuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZztcbiAgfVxufVxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gUmVhZGFibGUob3B0aW9ucykge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZWFkYWJsZSkpIHJldHVybiBuZXcgUmVhZGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZSA9IG5ldyBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5yZWFkID09PSAnZnVuY3Rpb24nKSB0aGlzLl9yZWFkID0gb3B0aW9ucy5yZWFkO1xuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBNYW51YWxseSBzaG92ZSBzb21ldGhpbmcgaW50byB0aGUgcmVhZCgpIGJ1ZmZlci5cbi8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBoaWdoV2F0ZXJNYXJrIGhhcyBub3QgYmVlbiBoaXQgeWV0LFxuLy8gc2ltaWxhciB0byBob3cgV3JpdGFibGUud3JpdGUoKSByZXR1cm5zIHRydWUgaWYgeW91IHNob3VsZFxuLy8gd3JpdGUoKSBzb21lIG1vcmUuXG5SZWFkYWJsZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gZW5jb2RpbmcgfHwgc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuICAgIGlmIChlbmNvZGluZyAhPT0gc3RhdGUuZW5jb2RpbmcpIHtcbiAgICAgIGNodW5rID0gYnVmZmVyU2hpbS5mcm9tKGNodW5rLCBlbmNvZGluZyk7XG4gICAgICBlbmNvZGluZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGZhbHNlKTtcbn07XG5cbi8vIFVuc2hpZnQgc2hvdWxkICphbHdheXMqIGJlIHNvbWV0aGluZyBkaXJlY3RseSBvdXQgb2YgcmVhZCgpXG5SZWFkYWJsZS5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uIChjaHVuaykge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICByZXR1cm4gcmVhZGFibGVBZGRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssICcnLCB0cnVlKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5pc1BhdXNlZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyA9PT0gZmFsc2U7XG59O1xuXG5mdW5jdGlvbiByZWFkYWJsZUFkZENodW5rKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgYWRkVG9Gcm9udCkge1xuICB2YXIgZXIgPSBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKTtcbiAgaWYgKGVyKSB7XG4gICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9IGVsc2UgaWYgKGNodW5rID09PSBudWxsKSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSk7XG4gIH0gZWxzZSBpZiAoc3RhdGUub2JqZWN0TW9kZSB8fCBjaHVuayAmJiBjaHVuay5sZW5ndGggPiAwKSB7XG4gICAgaWYgKHN0YXRlLmVuZGVkICYmICFhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnB1c2goKSBhZnRlciBFT0YnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSBpZiAoc3RhdGUuZW5kRW1pdHRlZCAmJiBhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgX2UgPSBuZXcgRXJyb3IoJ3N0cmVhbS51bnNoaWZ0KCkgYWZ0ZXIgZW5kIGV2ZW50Jyk7XG4gICAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBfZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBza2lwQWRkO1xuICAgICAgaWYgKHN0YXRlLmRlY29kZXIgJiYgIWFkZFRvRnJvbnQgJiYgIWVuY29kaW5nKSB7XG4gICAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG4gICAgICAgIHNraXBBZGQgPSAhc3RhdGUub2JqZWN0TW9kZSAmJiBjaHVuay5sZW5ndGggPT09IDA7XG4gICAgICB9XG5cbiAgICAgIGlmICghYWRkVG9Gcm9udCkgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgICAvLyBEb24ndCBhZGQgdG8gdGhlIGJ1ZmZlciBpZiB3ZSd2ZSBkZWNvZGVkIHRvIGFuIGVtcHR5IHN0cmluZyBjaHVuayBhbmRcbiAgICAgIC8vIHdlJ3JlIG5vdCBpbiBvYmplY3QgbW9kZVxuICAgICAgaWYgKCFza2lwQWRkKSB7XG4gICAgICAgIC8vIGlmIHdlIHdhbnQgdGhlIGRhdGEgbm93LCBqdXN0IGVtaXQgaXQuXG4gICAgICAgIGlmIChzdGF0ZS5mbG93aW5nICYmIHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuc3luYykge1xuICAgICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgY2h1bmspO1xuICAgICAgICAgIHN0cmVhbS5yZWFkKDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHVwZGF0ZSB0aGUgYnVmZmVyIGluZm8uXG4gICAgICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgICAgICAgIGlmIChhZGRUb0Zyb250KSBzdGF0ZS5idWZmZXIudW5zaGlmdChjaHVuayk7ZWxzZSBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG5cbiAgICAgICAgICBpZiAoc3RhdGUubmVlZFJlYWRhYmxlKSBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBtYXliZVJlYWRNb3JlKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfSBlbHNlIGlmICghYWRkVG9Gcm9udCkge1xuICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBuZWVkTW9yZURhdGEoc3RhdGUpO1xufVxuXG4vLyBpZiBpdCdzIHBhc3QgdGhlIGhpZ2ggd2F0ZXIgbWFyaywgd2UgY2FuIHB1c2ggaW4gc29tZSBtb3JlLlxuLy8gQWxzbywgaWYgd2UgaGF2ZSBubyBkYXRhIHlldCwgd2UgY2FuIHN0YW5kIHNvbWVcbi8vIG1vcmUgYnl0ZXMuICBUaGlzIGlzIHRvIHdvcmsgYXJvdW5kIGNhc2VzIHdoZXJlIGh3bT0wLFxuLy8gc3VjaCBhcyB0aGUgcmVwbC4gIEFsc28sIGlmIHRoZSBwdXNoKCkgdHJpZ2dlcmVkIGFcbi8vIHJlYWRhYmxlIGV2ZW50LCBhbmQgdGhlIHVzZXIgY2FsbGVkIHJlYWQobGFyZ2VOdW1iZXIpIHN1Y2ggdGhhdFxuLy8gbmVlZFJlYWRhYmxlIHdhcyBzZXQsIHRoZW4gd2Ugb3VnaHQgdG8gcHVzaCBtb3JlLCBzbyB0aGF0IGFub3RoZXJcbi8vICdyZWFkYWJsZScgZXZlbnQgd2lsbCBiZSB0cmlnZ2VyZWQuXG5mdW5jdGlvbiBuZWVkTW9yZURhdGEoc3RhdGUpIHtcbiAgcmV0dXJuICFzdGF0ZS5lbmRlZCAmJiAoc3RhdGUubmVlZFJlYWRhYmxlIHx8IHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcmsgfHwgc3RhdGUubGVuZ3RoID09PSAwKTtcbn1cblxuLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG5SZWFkYWJsZS5wcm90b3R5cGUuc2V0RW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jKSB7XG4gIGlmICghU3RyaW5nRGVjb2RlcikgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuZGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKGVuYyk7XG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuZW5jb2RpbmcgPSBlbmM7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gRG9uJ3QgcmFpc2UgdGhlIGh3bSA+IDhNQlxudmFyIE1BWF9IV00gPSAweDgwMDAwMDtcbmZ1bmN0aW9uIGNvbXB1dGVOZXdIaWdoV2F0ZXJNYXJrKG4pIHtcbiAgaWYgKG4gPj0gTUFYX0hXTSkge1xuICAgIG4gPSBNQVhfSFdNO1xuICB9IGVsc2Uge1xuICAgIC8vIEdldCB0aGUgbmV4dCBoaWdoZXN0IHBvd2VyIG9mIDIgdG8gcHJldmVudCBpbmNyZWFzaW5nIGh3bSBleGNlc3NpdmVseSBpblxuICAgIC8vIHRpbnkgYW1vdW50c1xuICAgIG4tLTtcbiAgICBuIHw9IG4gPj4+IDE7XG4gICAgbiB8PSBuID4+PiAyO1xuICAgIG4gfD0gbiA+Pj4gNDtcbiAgICBuIHw9IG4gPj4+IDg7XG4gICAgbiB8PSBuID4+PiAxNjtcbiAgICBuKys7XG4gIH1cbiAgcmV0dXJuIG47XG59XG5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgZGVzaWduZWQgdG8gYmUgaW5saW5hYmxlLCBzbyBwbGVhc2UgdGFrZSBjYXJlIHdoZW4gbWFraW5nXG4vLyBjaGFuZ2VzIHRvIHRoZSBmdW5jdGlvbiBib2R5LlxuZnVuY3Rpb24gaG93TXVjaFRvUmVhZChuLCBzdGF0ZSkge1xuICBpZiAobiA8PSAwIHx8IHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZCkgcmV0dXJuIDA7XG4gIGlmIChzdGF0ZS5vYmplY3RNb2RlKSByZXR1cm4gMTtcbiAgaWYgKG4gIT09IG4pIHtcbiAgICAvLyBPbmx5IGZsb3cgb25lIGJ1ZmZlciBhdCBhIHRpbWVcbiAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5sZW5ndGgpIHJldHVybiBzdGF0ZS5idWZmZXIuaGVhZC5kYXRhLmxlbmd0aDtlbHNlIHJldHVybiBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgLy8gSWYgd2UncmUgYXNraW5nIGZvciBtb3JlIHRoYW4gdGhlIGN1cnJlbnQgaHdtLCB0aGVuIHJhaXNlIHRoZSBod20uXG4gIGlmIChuID4gc3RhdGUuaGlnaFdhdGVyTWFyaykgc3RhdGUuaGlnaFdhdGVyTWFyayA9IGNvbXB1dGVOZXdIaWdoV2F0ZXJNYXJrKG4pO1xuICBpZiAobiA8PSBzdGF0ZS5sZW5ndGgpIHJldHVybiBuO1xuICAvLyBEb24ndCBoYXZlIGVub3VnaFxuICBpZiAoIXN0YXRlLmVuZGVkKSB7XG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICByZXR1cm4gMDtcbiAgfVxuICByZXR1cm4gc3RhdGUubGVuZ3RoO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbiAobikge1xuICBkZWJ1ZygncmVhZCcsIG4pO1xuICBuID0gcGFyc2VJbnQobiwgMTApO1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgbk9yaWcgPSBuO1xuXG4gIGlmIChuICE9PSAwKSBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcblxuICAvLyBpZiB3ZSdyZSBkb2luZyByZWFkKDApIHRvIHRyaWdnZXIgYSByZWFkYWJsZSBldmVudCwgYnV0IHdlXG4gIC8vIGFscmVhZHkgaGF2ZSBhIGJ1bmNoIG9mIGRhdGEgaW4gdGhlIGJ1ZmZlciwgdGhlbiBqdXN0IHRyaWdnZXJcbiAgLy8gdGhlICdyZWFkYWJsZScgZXZlbnQgYW5kIG1vdmUgb24uXG4gIGlmIChuID09PSAwICYmIHN0YXRlLm5lZWRSZWFkYWJsZSAmJiAoc3RhdGUubGVuZ3RoID49IHN0YXRlLmhpZ2hXYXRlck1hcmsgfHwgc3RhdGUuZW5kZWQpKSB7XG4gICAgZGVidWcoJ3JlYWQ6IGVtaXRSZWFkYWJsZScsIHN0YXRlLmxlbmd0aCwgc3RhdGUuZW5kZWQpO1xuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUuZW5kZWQpIGVuZFJlYWRhYmxlKHRoaXMpO2Vsc2UgZW1pdFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbiA9IGhvd011Y2hUb1JlYWQobiwgc3RhdGUpO1xuXG4gIC8vIGlmIHdlJ3ZlIGVuZGVkLCBhbmQgd2UncmUgbm93IGNsZWFyLCB0aGVuIGZpbmlzaCBpdCB1cC5cbiAgaWYgKG4gPT09IDAgJiYgc3RhdGUuZW5kZWQpIHtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSBlbmRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEFsbCB0aGUgYWN0dWFsIGNodW5rIGdlbmVyYXRpb24gbG9naWMgbmVlZHMgdG8gYmVcbiAgLy8gKmJlbG93KiB0aGUgY2FsbCB0byBfcmVhZC4gIFRoZSByZWFzb24gaXMgdGhhdCBpbiBjZXJ0YWluXG4gIC8vIHN5bnRoZXRpYyBzdHJlYW0gY2FzZXMsIHN1Y2ggYXMgcGFzc3Rocm91Z2ggc3RyZWFtcywgX3JlYWRcbiAgLy8gbWF5IGJlIGEgY29tcGxldGVseSBzeW5jaHJvbm91cyBvcGVyYXRpb24gd2hpY2ggbWF5IGNoYW5nZVxuICAvLyB0aGUgc3RhdGUgb2YgdGhlIHJlYWQgYnVmZmVyLCBwcm92aWRpbmcgZW5vdWdoIGRhdGEgd2hlblxuICAvLyBiZWZvcmUgdGhlcmUgd2FzICpub3QqIGVub3VnaC5cbiAgLy9cbiAgLy8gU28sIHRoZSBzdGVwcyBhcmU6XG4gIC8vIDEuIEZpZ3VyZSBvdXQgd2hhdCB0aGUgc3RhdGUgb2YgdGhpbmdzIHdpbGwgYmUgYWZ0ZXIgd2UgZG9cbiAgLy8gYSByZWFkIGZyb20gdGhlIGJ1ZmZlci5cbiAgLy9cbiAgLy8gMi4gSWYgdGhhdCByZXN1bHRpbmcgc3RhdGUgd2lsbCB0cmlnZ2VyIGEgX3JlYWQsIHRoZW4gY2FsbCBfcmVhZC5cbiAgLy8gTm90ZSB0aGF0IHRoaXMgbWF5IGJlIGFzeW5jaHJvbm91cywgb3Igc3luY2hyb25vdXMuICBZZXMsIGl0IGlzXG4gIC8vIGRlZXBseSB1Z2x5IHRvIHdyaXRlIEFQSXMgdGhpcyB3YXksIGJ1dCB0aGF0IHN0aWxsIGRvZXNuJ3QgbWVhblxuICAvLyB0aGF0IHRoZSBSZWFkYWJsZSBjbGFzcyBzaG91bGQgYmVoYXZlIGltcHJvcGVybHksIGFzIHN0cmVhbXMgYXJlXG4gIC8vIGRlc2lnbmVkIHRvIGJlIHN5bmMvYXN5bmMgYWdub3N0aWMuXG4gIC8vIFRha2Ugbm90ZSBpZiB0aGUgX3JlYWQgY2FsbCBpcyBzeW5jIG9yIGFzeW5jIChpZSwgaWYgdGhlIHJlYWQgY2FsbFxuICAvLyBoYXMgcmV0dXJuZWQgeWV0KSwgc28gdGhhdCB3ZSBrbm93IHdoZXRoZXIgb3Igbm90IGl0J3Mgc2FmZSB0byBlbWl0XG4gIC8vICdyZWFkYWJsZScgZXRjLlxuICAvL1xuICAvLyAzLiBBY3R1YWxseSBwdWxsIHRoZSByZXF1ZXN0ZWQgY2h1bmtzIG91dCBvZiB0aGUgYnVmZmVyIGFuZCByZXR1cm4uXG5cbiAgLy8gaWYgd2UgbmVlZCBhIHJlYWRhYmxlIGV2ZW50LCB0aGVuIHdlIG5lZWQgdG8gZG8gc29tZSByZWFkaW5nLlxuICB2YXIgZG9SZWFkID0gc3RhdGUubmVlZFJlYWRhYmxlO1xuICBkZWJ1ZygnbmVlZCByZWFkYWJsZScsIGRvUmVhZCk7XG5cbiAgLy8gaWYgd2UgY3VycmVudGx5IGhhdmUgbGVzcyB0aGFuIHRoZSBoaWdoV2F0ZXJNYXJrLCB0aGVuIGFsc28gcmVhZCBzb21lXG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgfHwgc3RhdGUubGVuZ3RoIC0gbiA8IHN0YXRlLmhpZ2hXYXRlck1hcmspIHtcbiAgICBkb1JlYWQgPSB0cnVlO1xuICAgIGRlYnVnKCdsZW5ndGggbGVzcyB0aGFuIHdhdGVybWFyaycsIGRvUmVhZCk7XG4gIH1cblxuICAvLyBob3dldmVyLCBpZiB3ZSd2ZSBlbmRlZCwgdGhlbiB0aGVyZSdzIG5vIHBvaW50LCBhbmQgaWYgd2UncmUgYWxyZWFkeVxuICAvLyByZWFkaW5nLCB0aGVuIGl0J3MgdW5uZWNlc3NhcnkuXG4gIGlmIChzdGF0ZS5lbmRlZCB8fCBzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZG9SZWFkID0gZmFsc2U7XG4gICAgZGVidWcoJ3JlYWRpbmcgb3IgZW5kZWQnLCBkb1JlYWQpO1xuICB9IGVsc2UgaWYgKGRvUmVhZCkge1xuICAgIGRlYnVnKCdkbyByZWFkJyk7XG4gICAgc3RhdGUucmVhZGluZyA9IHRydWU7XG4gICAgc3RhdGUuc3luYyA9IHRydWU7XG4gICAgLy8gaWYgdGhlIGxlbmd0aCBpcyBjdXJyZW50bHkgemVybywgdGhlbiB3ZSAqbmVlZCogYSByZWFkYWJsZSBldmVudC5cbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIC8vIGNhbGwgaW50ZXJuYWwgcmVhZCBtZXRob2RcbiAgICB0aGlzLl9yZWFkKHN0YXRlLmhpZ2hXYXRlck1hcmspO1xuICAgIHN0YXRlLnN5bmMgPSBmYWxzZTtcbiAgICAvLyBJZiBfcmVhZCBwdXNoZWQgZGF0YSBzeW5jaHJvbm91c2x5LCB0aGVuIGByZWFkaW5nYCB3aWxsIGJlIGZhbHNlLFxuICAgIC8vIGFuZCB3ZSBuZWVkIHRvIHJlLWV2YWx1YXRlIGhvdyBtdWNoIGRhdGEgd2UgY2FuIHJldHVybiB0byB0aGUgdXNlci5cbiAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIG4gPSBob3dNdWNoVG9SZWFkKG5PcmlnLCBzdGF0ZSk7XG4gIH1cblxuICB2YXIgcmV0O1xuICBpZiAobiA+IDApIHJldCA9IGZyb21MaXN0KG4sIHN0YXRlKTtlbHNlIHJldCA9IG51bGw7XG5cbiAgaWYgKHJldCA9PT0gbnVsbCkge1xuICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgbiA9IDA7XG4gIH0gZWxzZSB7XG4gICAgc3RhdGUubGVuZ3RoIC09IG47XG4gIH1cblxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gICAgLy8gYXMgc29vbiBhcyB3ZSAqZG8qIGdldCBzb21ldGhpbmcgaW50byB0aGUgYnVmZmVyLlxuICAgIGlmICghc3RhdGUuZW5kZWQpIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG5cbiAgICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gICAgaWYgKG5PcmlnICE9PSBuICYmIHN0YXRlLmVuZGVkKSBlbmRSZWFkYWJsZSh0aGlzKTtcbiAgfVxuXG4gIGlmIChyZXQgIT09IG51bGwpIHRoaXMuZW1pdCgnZGF0YScsIHJldCk7XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGNodW5rSW52YWxpZChzdGF0ZSwgY2h1bmspIHtcbiAgdmFyIGVyID0gbnVsbDtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoY2h1bmspICYmIHR5cGVvZiBjaHVuayAhPT0gJ3N0cmluZycgJiYgY2h1bmsgIT09IG51bGwgJiYgY2h1bmsgIT09IHVuZGVmaW5lZCAmJiAhc3RhdGUub2JqZWN0TW9kZSkge1xuICAgIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICB9XG4gIHJldHVybiBlcjtcbn1cblxuZnVuY3Rpb24gb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5lbmRlZCkgcmV0dXJuO1xuICBpZiAoc3RhdGUuZGVjb2Rlcikge1xuICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgaWYgKGNodW5rICYmIGNodW5rLmxlbmd0aCkge1xuICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG5cbiAgLy8gZW1pdCAncmVhZGFibGUnIG5vdyB0byBtYWtlIHN1cmUgaXQgZ2V0cyBwaWNrZWQgdXAuXG4gIGVtaXRSZWFkYWJsZShzdHJlYW0pO1xufVxuXG4vLyBEb24ndCBlbWl0IHJlYWRhYmxlIHJpZ2h0IGF3YXkgaW4gc3luYyBtb2RlLCBiZWNhdXNlIHRoaXMgY2FuIHRyaWdnZXJcbi8vIGFub3RoZXIgcmVhZCgpIGNhbGwgPT4gc3RhY2sgb3ZlcmZsb3cuICBUaGlzIHdheSwgaXQgbWlnaHQgdHJpZ2dlclxuLy8gYSBuZXh0VGljayByZWN1cnNpb24gd2FybmluZywgYnV0IHRoYXQncyBub3Qgc28gYmFkLlxuZnVuY3Rpb24gZW1pdFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHN0YXRlLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICBpZiAoIXN0YXRlLmVtaXR0ZWRSZWFkYWJsZSkge1xuICAgIGRlYnVnKCdlbWl0UmVhZGFibGUnLCBzdGF0ZS5mbG93aW5nKTtcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSB0cnVlO1xuICAgIGlmIChzdGF0ZS5zeW5jKSBwcm9jZXNzTmV4dFRpY2soZW1pdFJlYWRhYmxlXywgc3RyZWFtKTtlbHNlIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGVfKHN0cmVhbSkge1xuICBkZWJ1ZygnZW1pdCByZWFkYWJsZScpO1xuICBzdHJlYW0uZW1pdCgncmVhZGFibGUnKTtcbiAgZmxvdyhzdHJlYW0pO1xufVxuXG4vLyBhdCB0aGlzIHBvaW50LCB0aGUgdXNlciBoYXMgcHJlc3VtYWJseSBzZWVuIHRoZSAncmVhZGFibGUnIGV2ZW50LFxuLy8gYW5kIGNhbGxlZCByZWFkKCkgdG8gY29uc3VtZSBzb21lIGRhdGEuICB0aGF0IG1heSBoYXZlIHRyaWdnZXJlZFxuLy8gaW4gdHVybiBhbm90aGVyIF9yZWFkKG4pIGNhbGwsIGluIHdoaWNoIGNhc2UgcmVhZGluZyA9IHRydWUgaWZcbi8vIGl0J3MgaW4gcHJvZ3Jlc3MuXG4vLyBIb3dldmVyLCBpZiB3ZSdyZSBub3QgZW5kZWQsIG9yIHJlYWRpbmcsIGFuZCB0aGUgbGVuZ3RoIDwgaHdtLFxuLy8gdGhlbiBnbyBhaGVhZCBhbmQgdHJ5IHRvIHJlYWQgc29tZSBtb3JlIHByZWVtcHRpdmVseS5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmUoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlYWRpbmdNb3JlKSB7XG4gICAgc3RhdGUucmVhZGluZ01vcmUgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhtYXliZVJlYWRNb3JlXywgc3RyZWFtLCBzdGF0ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZV8oc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbGVuID0gc3RhdGUubGVuZ3RoO1xuICB3aGlsZSAoIXN0YXRlLnJlYWRpbmcgJiYgIXN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLmVuZGVkICYmIHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcmspIHtcbiAgICBkZWJ1ZygnbWF5YmVSZWFkTW9yZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgICBpZiAobGVuID09PSBzdGF0ZS5sZW5ndGgpXG4gICAgICAvLyBkaWRuJ3QgZ2V0IGFueSBkYXRhLCBzdG9wIHNwaW5uaW5nLlxuICAgICAgYnJlYWs7ZWxzZSBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbiAobikge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5SZWFkYWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uIChkZXN0LCBwaXBlT3B0cykge1xuICB2YXIgc3JjID0gdGhpcztcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICBzd2l0Y2ggKHN0YXRlLnBpcGVzQ291bnQpIHtcbiAgICBjYXNlIDA6XG4gICAgICBzdGF0ZS5waXBlcyA9IGRlc3Q7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDE6XG4gICAgICBzdGF0ZS5waXBlcyA9IFtzdGF0ZS5waXBlcywgZGVzdF07XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgc3RhdGUucGlwZXMucHVzaChkZXN0KTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHN0YXRlLnBpcGVzQ291bnQgKz0gMTtcbiAgZGVidWcoJ3BpcGUgY291bnQ9JWQgb3B0cz0laicsIHN0YXRlLnBpcGVzQ291bnQsIHBpcGVPcHRzKTtcblxuICB2YXIgZG9FbmQgPSAoIXBpcGVPcHRzIHx8IHBpcGVPcHRzLmVuZCAhPT0gZmFsc2UpICYmIGRlc3QgIT09IHByb2Nlc3Muc3Rkb3V0ICYmIGRlc3QgIT09IHByb2Nlc3Muc3RkZXJyO1xuXG4gIHZhciBlbmRGbiA9IGRvRW5kID8gb25lbmQgOiBjbGVhbnVwO1xuICBpZiAoc3RhdGUuZW5kRW1pdHRlZCkgcHJvY2Vzc05leHRUaWNrKGVuZEZuKTtlbHNlIHNyYy5vbmNlKCdlbmQnLCBlbmRGbik7XG5cbiAgZGVzdC5vbigndW5waXBlJywgb251bnBpcGUpO1xuICBmdW5jdGlvbiBvbnVucGlwZShyZWFkYWJsZSkge1xuICAgIGRlYnVnKCdvbnVucGlwZScpO1xuICAgIGlmIChyZWFkYWJsZSA9PT0gc3JjKSB7XG4gICAgICBjbGVhbnVwKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgZGVidWcoJ29uZW5kJyk7XG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG4gIC8vIHdoZW4gdGhlIGRlc3QgZHJhaW5zLCBpdCByZWR1Y2VzIHRoZSBhd2FpdERyYWluIGNvdW50ZXJcbiAgLy8gb24gdGhlIHNvdXJjZS4gIFRoaXMgd291bGQgYmUgbW9yZSBlbGVnYW50IHdpdGggYSAub25jZSgpXG4gIC8vIGhhbmRsZXIgaW4gZmxvdygpLCBidXQgYWRkaW5nIGFuZCByZW1vdmluZyByZXBlYXRlZGx5IGlzXG4gIC8vIHRvbyBzbG93LlxuICB2YXIgb25kcmFpbiA9IHBpcGVPbkRyYWluKHNyYyk7XG4gIGRlc3Qub24oJ2RyYWluJywgb25kcmFpbik7XG5cbiAgdmFyIGNsZWFuZWRVcCA9IGZhbHNlO1xuICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgIGRlYnVnKCdjbGVhbnVwJyk7XG4gICAgLy8gY2xlYW51cCBldmVudCBoYW5kbGVycyBvbmNlIHRoZSBwaXBlIGlzIGJyb2tlblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCd1bnBpcGUnLCBvbnVucGlwZSk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBjbGVhbnVwKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuXG4gICAgY2xlYW5lZFVwID0gdHJ1ZTtcblxuICAgIC8vIGlmIHRoZSByZWFkZXIgaXMgd2FpdGluZyBmb3IgYSBkcmFpbiBldmVudCBmcm9tIHRoaXNcbiAgICAvLyBzcGVjaWZpYyB3cml0ZXIsIHRoZW4gaXQgd291bGQgY2F1c2UgaXQgdG8gbmV2ZXIgc3RhcnRcbiAgICAvLyBmbG93aW5nIGFnYWluLlxuICAgIC8vIFNvLCBpZiB0aGlzIGlzIGF3YWl0aW5nIGEgZHJhaW4sIHRoZW4gd2UganVzdCBjYWxsIGl0IG5vdy5cbiAgICAvLyBJZiB3ZSBkb24ndCBrbm93LCB0aGVuIGFzc3VtZSB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBvbmUuXG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gJiYgKCFkZXN0Ll93cml0YWJsZVN0YXRlIHx8IGRlc3QuX3dyaXRhYmxlU3RhdGUubmVlZERyYWluKSkgb25kcmFpbigpO1xuICB9XG5cbiAgLy8gSWYgdGhlIHVzZXIgcHVzaGVzIG1vcmUgZGF0YSB3aGlsZSB3ZSdyZSB3cml0aW5nIHRvIGRlc3QgdGhlbiB3ZSdsbCBlbmQgdXBcbiAgLy8gaW4gb25kYXRhIGFnYWluLiBIb3dldmVyLCB3ZSBvbmx5IHdhbnQgdG8gaW5jcmVhc2UgYXdhaXREcmFpbiBvbmNlIGJlY2F1c2VcbiAgLy8gZGVzdCB3aWxsIG9ubHkgZW1pdCBvbmUgJ2RyYWluJyBldmVudCBmb3IgdGhlIG11bHRpcGxlIHdyaXRlcy5cbiAgLy8gPT4gSW50cm9kdWNlIGEgZ3VhcmQgb24gaW5jcmVhc2luZyBhd2FpdERyYWluLlxuICB2YXIgaW5jcmVhc2VkQXdhaXREcmFpbiA9IGZhbHNlO1xuICBzcmMub24oJ2RhdGEnLCBvbmRhdGEpO1xuICBmdW5jdGlvbiBvbmRhdGEoY2h1bmspIHtcbiAgICBkZWJ1Zygnb25kYXRhJyk7XG4gICAgaW5jcmVhc2VkQXdhaXREcmFpbiA9IGZhbHNlO1xuICAgIHZhciByZXQgPSBkZXN0LndyaXRlKGNodW5rKTtcbiAgICBpZiAoZmFsc2UgPT09IHJldCAmJiAhaW5jcmVhc2VkQXdhaXREcmFpbikge1xuICAgICAgLy8gSWYgdGhlIHVzZXIgdW5waXBlZCBkdXJpbmcgYGRlc3Qud3JpdGUoKWAsIGl0IGlzIHBvc3NpYmxlXG4gICAgICAvLyB0byBnZXQgc3R1Y2sgaW4gYSBwZXJtYW5lbnRseSBwYXVzZWQgc3RhdGUgaWYgdGhhdCB3cml0ZVxuICAgICAgLy8gYWxzbyByZXR1cm5lZCBmYWxzZS5cbiAgICAgIC8vID0+IENoZWNrIHdoZXRoZXIgYGRlc3RgIGlzIHN0aWxsIGEgcGlwaW5nIGRlc3RpbmF0aW9uLlxuICAgICAgaWYgKChzdGF0ZS5waXBlc0NvdW50ID09PSAxICYmIHN0YXRlLnBpcGVzID09PSBkZXN0IHx8IHN0YXRlLnBpcGVzQ291bnQgPiAxICYmIGluZGV4T2Yoc3RhdGUucGlwZXMsIGRlc3QpICE9PSAtMSkgJiYgIWNsZWFuZWRVcCkge1xuICAgICAgICBkZWJ1ZygnZmFsc2Ugd3JpdGUgcmVzcG9uc2UsIHBhdXNlJywgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4pO1xuICAgICAgICBzcmMuX3JlYWRhYmxlU3RhdGUuYXdhaXREcmFpbisrO1xuICAgICAgICBpbmNyZWFzZWRBd2FpdERyYWluID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHNyYy5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBkZXN0IGhhcyBhbiBlcnJvciwgdGhlbiBzdG9wIHBpcGluZyBpbnRvIGl0LlxuICAvLyBob3dldmVyLCBkb24ndCBzdXBwcmVzcyB0aGUgdGhyb3dpbmcgYmVoYXZpb3IgZm9yIHRoaXMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBkZWJ1Zygnb25lcnJvcicsIGVyKTtcbiAgICB1bnBpcGUoKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGlmIChFRWxpc3RlbmVyQ291bnQoZGVzdCwgJ2Vycm9yJykgPT09IDApIGRlc3QuZW1pdCgnZXJyb3InLCBlcik7XG4gIH1cblxuICAvLyBNYWtlIHN1cmUgb3VyIGVycm9yIGhhbmRsZXIgaXMgYXR0YWNoZWQgYmVmb3JlIHVzZXJsYW5kIG9uZXMuXG4gIHByZXBlbmRMaXN0ZW5lcihkZXN0LCAnZXJyb3InLCBvbmVycm9yKTtcblxuICAvLyBCb3RoIGNsb3NlIGFuZCBmaW5pc2ggc2hvdWxkIHRyaWdnZXIgdW5waXBlLCBidXQgb25seSBvbmNlLlxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG4gIGZ1bmN0aW9uIG9uZmluaXNoKCkge1xuICAgIGRlYnVnKCdvbmZpbmlzaCcpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG5cbiAgZnVuY3Rpb24gdW5waXBlKCkge1xuICAgIGRlYnVnKCd1bnBpcGUnKTtcbiAgICBzcmMudW5waXBlKGRlc3QpO1xuICB9XG5cbiAgLy8gdGVsbCB0aGUgZGVzdCB0aGF0IGl0J3MgYmVpbmcgcGlwZWQgdG9cbiAgZGVzdC5lbWl0KCdwaXBlJywgc3JjKTtcblxuICAvLyBzdGFydCB0aGUgZmxvdyBpZiBpdCBoYXNuJ3QgYmVlbiBzdGFydGVkIGFscmVhZHkuXG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdwaXBlIHJlc3VtZScpO1xuICAgIHNyYy5yZXN1bWUoKTtcbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufTtcblxuZnVuY3Rpb24gcGlwZU9uRHJhaW4oc3JjKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXRlID0gc3JjLl9yZWFkYWJsZVN0YXRlO1xuICAgIGRlYnVnKCdwaXBlT25EcmFpbicsIHN0YXRlLmF3YWl0RHJhaW4pO1xuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluKSBzdGF0ZS5hd2FpdERyYWluLS07XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gPT09IDAgJiYgRUVsaXN0ZW5lckNvdW50KHNyYywgJ2RhdGEnKSkge1xuICAgICAgc3RhdGUuZmxvd2luZyA9IHRydWU7XG4gICAgICBmbG93KHNyYyk7XG4gICAgfVxuICB9O1xufVxuXG5SZWFkYWJsZS5wcm90b3R5cGUudW5waXBlID0gZnVuY3Rpb24gKGRlc3QpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICAvLyBpZiB3ZSdyZSBub3QgcGlwaW5nIGFueXdoZXJlLCB0aGVuIGRvIG5vdGhpbmcuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAwKSByZXR1cm4gdGhpcztcblxuICAvLyBqdXN0IG9uZSBkZXN0aW5hdGlvbi4gIG1vc3QgY29tbW9uIGNhc2UuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAxKSB7XG4gICAgLy8gcGFzc2VkIGluIG9uZSwgYnV0IGl0J3Mgbm90IHRoZSByaWdodCBvbmUuXG4gICAgaWYgKGRlc3QgJiYgZGVzdCAhPT0gc3RhdGUucGlwZXMpIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKCFkZXN0KSBkZXN0ID0gc3RhdGUucGlwZXM7XG5cbiAgICAvLyBnb3QgYSBtYXRjaC5cbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuICAgIGlmIChkZXN0KSBkZXN0LmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gc2xvdyBjYXNlLiBtdWx0aXBsZSBwaXBlIGRlc3RpbmF0aW9ucy5cblxuICBpZiAoIWRlc3QpIHtcbiAgICAvLyByZW1vdmUgYWxsLlxuICAgIHZhciBkZXN0cyA9IHN0YXRlLnBpcGVzO1xuICAgIHZhciBsZW4gPSBzdGF0ZS5waXBlc0NvdW50O1xuICAgIHN0YXRlLnBpcGVzID0gbnVsbDtcbiAgICBzdGF0ZS5waXBlc0NvdW50ID0gMDtcbiAgICBzdGF0ZS5mbG93aW5nID0gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgbGVuOyBfaSsrKSB7XG4gICAgICBkZXN0c1tfaV0uZW1pdCgndW5waXBlJywgdGhpcyk7XG4gICAgfXJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gdHJ5IHRvIGZpbmQgdGhlIHJpZ2h0IG9uZS5cbiAgdmFyIGkgPSBpbmRleE9mKHN0YXRlLnBpcGVzLCBkZXN0KTtcbiAgaWYgKGkgPT09IC0xKSByZXR1cm4gdGhpcztcblxuICBzdGF0ZS5waXBlcy5zcGxpY2UoaSwgMSk7XG4gIHN0YXRlLnBpcGVzQ291bnQgLT0gMTtcbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpIHN0YXRlLnBpcGVzID0gc3RhdGUucGlwZXNbMF07XG5cbiAgZGVzdC5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIHNldCB1cCBkYXRhIGV2ZW50cyBpZiB0aGV5IGFyZSBhc2tlZCBmb3Jcbi8vIEVuc3VyZSByZWFkYWJsZSBsaXN0ZW5lcnMgZXZlbnR1YWxseSBnZXQgc29tZXRoaW5nXG5SZWFkYWJsZS5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoZXYsIGZuKSB7XG4gIHZhciByZXMgPSBTdHJlYW0ucHJvdG90eXBlLm9uLmNhbGwodGhpcywgZXYsIGZuKTtcblxuICBpZiAoZXYgPT09ICdkYXRhJykge1xuICAgIC8vIFN0YXJ0IGZsb3dpbmcgb24gbmV4dCB0aWNrIGlmIHN0cmVhbSBpc24ndCBleHBsaWNpdGx5IHBhdXNlZFxuICAgIGlmICh0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgIT09IGZhbHNlKSB0aGlzLnJlc3VtZSgpO1xuICB9IGVsc2UgaWYgKGV2ID09PSAncmVhZGFibGUnKSB7XG4gICAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgICBpZiAoIXN0YXRlLmVuZEVtaXR0ZWQgJiYgIXN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nKSB7XG4gICAgICBzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZyA9IHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgICAgIGlmICghc3RhdGUucmVhZGluZykge1xuICAgICAgICBwcm9jZXNzTmV4dFRpY2soblJlYWRpbmdOZXh0VGljaywgdGhpcyk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlLmxlbmd0aCkge1xuICAgICAgICBlbWl0UmVhZGFibGUodGhpcywgc3RhdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuUmVhZGFibGUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gUmVhZGFibGUucHJvdG90eXBlLm9uO1xuXG5mdW5jdGlvbiBuUmVhZGluZ05leHRUaWNrKHNlbGYpIHtcbiAgZGVidWcoJ3JlYWRhYmxlIG5leHR0aWNrIHJlYWQgMCcpO1xuICBzZWxmLnJlYWQoMCk7XG59XG5cbi8vIHBhdXNlKCkgYW5kIHJlc3VtZSgpIGFyZSByZW1uYW50cyBvZiB0aGUgbGVnYWN5IHJlYWRhYmxlIHN0cmVhbSBBUElcbi8vIElmIHRoZSB1c2VyIHVzZXMgdGhlbSwgdGhlbiBzd2l0Y2ggaW50byBvbGQgbW9kZS5cblJlYWRhYmxlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICByZXN1bWUodGhpcywgc3RhdGUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gcmVzdW1lKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZXN1bWVTY2hlZHVsZWQpIHtcbiAgICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhyZXN1bWVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXN1bWVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfVxuXG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdGF0ZS5hd2FpdERyYWluID0gMDtcbiAgc3RyZWFtLmVtaXQoJ3Jlc3VtZScpO1xuICBmbG93KHN0cmVhbSk7XG4gIGlmIChzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5yZWFkaW5nKSBzdHJlYW0ucmVhZCgwKTtcbn1cblxuUmVhZGFibGUucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIHdoaWxlIChzdGF0ZS5mbG93aW5nICYmIHN0cmVhbS5yZWFkKCkgIT09IG51bGwpIHt9XG59XG5cbi8vIHdyYXAgYW4gb2xkLXN0eWxlIHN0cmVhbSBhcyB0aGUgYXN5bmMgZGF0YSBzb3VyY2UuXG4vLyBUaGlzIGlzICpub3QqIHBhcnQgb2YgdGhlIHJlYWRhYmxlIHN0cmVhbSBpbnRlcmZhY2UuXG4vLyBJdCBpcyBhbiB1Z2x5IHVuZm9ydHVuYXRlIG1lc3Mgb2YgaGlzdG9yeS5cblJlYWRhYmxlLnByb3RvdHlwZS53cmFwID0gZnVuY3Rpb24gKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBlbmQnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhc3RhdGUuZW5kZWQpIHtcbiAgICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgICBpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKSBzZWxmLnB1c2goY2h1bmspO1xuICAgIH1cblxuICAgIHNlbGYucHVzaChudWxsKTtcbiAgfSk7XG5cbiAgc3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24gKGNodW5rKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgZGF0YScpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyKSBjaHVuayA9IHN0YXRlLmRlY29kZXIud3JpdGUoY2h1bmspO1xuXG4gICAgLy8gZG9uJ3Qgc2tpcCBvdmVyIGZhbHN5IHZhbHVlcyBpbiBvYmplY3RNb2RlXG4gICAgaWYgKHN0YXRlLm9iamVjdE1vZGUgJiYgKGNodW5rID09PSBudWxsIHx8IGNodW5rID09PSB1bmRlZmluZWQpKSByZXR1cm47ZWxzZSBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgKCFjaHVuayB8fCAhY2h1bmsubGVuZ3RoKSkgcmV0dXJuO1xuXG4gICAgdmFyIHJldCA9IHNlbGYucHVzaChjaHVuayk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICBzdHJlYW0ucGF1c2UoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHByb3h5IGFsbCB0aGUgb3RoZXIgbWV0aG9kcy5cbiAgLy8gaW1wb3J0YW50IHdoZW4gd3JhcHBpbmcgZmlsdGVycyBhbmQgZHVwbGV4ZXMuXG4gIGZvciAodmFyIGkgaW4gc3RyZWFtKSB7XG4gICAgaWYgKHRoaXNbaV0gPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygc3RyZWFtW2ldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzW2ldID0gZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBzdHJlYW1bbWV0aG9kXS5hcHBseShzdHJlYW0sIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgICB9KGkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHByb3h5IGNlcnRhaW4gaW1wb3J0YW50IGV2ZW50cy5cbiAgdmFyIGV2ZW50cyA9IFsnZXJyb3InLCAnY2xvc2UnLCAnZGVzdHJveScsICdwYXVzZScsICdyZXN1bWUnXTtcbiAgZm9yRWFjaChldmVudHMsIGZ1bmN0aW9uIChldikge1xuICAgIHN0cmVhbS5vbihldiwgc2VsZi5lbWl0LmJpbmQoc2VsZiwgZXYpKTtcbiAgfSk7XG5cbiAgLy8gd2hlbiB3ZSB0cnkgdG8gY29uc3VtZSBzb21lIG1vcmUgYnl0ZXMsIHNpbXBseSB1bnBhdXNlIHRoZVxuICAvLyB1bmRlcmx5aW5nIHN0cmVhbS5cbiAgc2VsZi5fcmVhZCA9IGZ1bmN0aW9uIChuKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgX3JlYWQnLCBuKTtcbiAgICBpZiAocGF1c2VkKSB7XG4gICAgICBwYXVzZWQgPSBmYWxzZTtcbiAgICAgIHN0cmVhbS5yZXN1bWUoKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHkuXG5SZWFkYWJsZS5fZnJvbUxpc3QgPSBmcm9tTGlzdDtcblxuLy8gUGx1Y2sgb2ZmIG4gYnl0ZXMgZnJvbSBhbiBhcnJheSBvZiBidWZmZXJzLlxuLy8gTGVuZ3RoIGlzIHRoZSBjb21iaW5lZCBsZW5ndGhzIG9mIGFsbCB0aGUgYnVmZmVycyBpbiB0aGUgbGlzdC5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgZGVzaWduZWQgdG8gYmUgaW5saW5hYmxlLCBzbyBwbGVhc2UgdGFrZSBjYXJlIHdoZW4gbWFraW5nXG4vLyBjaGFuZ2VzIHRvIHRoZSBmdW5jdGlvbiBib2R5LlxuZnVuY3Rpb24gZnJvbUxpc3Qobiwgc3RhdGUpIHtcbiAgLy8gbm90aGluZyBidWZmZXJlZFxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICB2YXIgcmV0O1xuICBpZiAoc3RhdGUub2JqZWN0TW9kZSkgcmV0ID0gc3RhdGUuYnVmZmVyLnNoaWZ0KCk7ZWxzZSBpZiAoIW4gfHwgbiA+PSBzdGF0ZS5sZW5ndGgpIHtcbiAgICAvLyByZWFkIGl0IGFsbCwgdHJ1bmNhdGUgdGhlIGxpc3RcbiAgICBpZiAoc3RhdGUuZGVjb2RlcikgcmV0ID0gc3RhdGUuYnVmZmVyLmpvaW4oJycpO2Vsc2UgaWYgKHN0YXRlLmJ1ZmZlci5sZW5ndGggPT09IDEpIHJldCA9IHN0YXRlLmJ1ZmZlci5oZWFkLmRhdGE7ZWxzZSByZXQgPSBzdGF0ZS5idWZmZXIuY29uY2F0KHN0YXRlLmxlbmd0aCk7XG4gICAgc3RhdGUuYnVmZmVyLmNsZWFyKCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBwYXJ0IG9mIGxpc3RcbiAgICByZXQgPSBmcm9tTGlzdFBhcnRpYWwobiwgc3RhdGUuYnVmZmVyLCBzdGF0ZS5kZWNvZGVyKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbi8vIEV4dHJhY3RzIG9ubHkgZW5vdWdoIGJ1ZmZlcmVkIGRhdGEgdG8gc2F0aXNmeSB0aGUgYW1vdW50IHJlcXVlc3RlZC5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgZGVzaWduZWQgdG8gYmUgaW5saW5hYmxlLCBzbyBwbGVhc2UgdGFrZSBjYXJlIHdoZW4gbWFraW5nXG4vLyBjaGFuZ2VzIHRvIHRoZSBmdW5jdGlvbiBib2R5LlxuZnVuY3Rpb24gZnJvbUxpc3RQYXJ0aWFsKG4sIGxpc3QsIGhhc1N0cmluZ3MpIHtcbiAgdmFyIHJldDtcbiAgaWYgKG4gPCBsaXN0LmhlYWQuZGF0YS5sZW5ndGgpIHtcbiAgICAvLyBzbGljZSBpcyB0aGUgc2FtZSBmb3IgYnVmZmVycyBhbmQgc3RyaW5nc1xuICAgIHJldCA9IGxpc3QuaGVhZC5kYXRhLnNsaWNlKDAsIG4pO1xuICAgIGxpc3QuaGVhZC5kYXRhID0gbGlzdC5oZWFkLmRhdGEuc2xpY2Uobik7XG4gIH0gZWxzZSBpZiAobiA9PT0gbGlzdC5oZWFkLmRhdGEubGVuZ3RoKSB7XG4gICAgLy8gZmlyc3QgY2h1bmsgaXMgYSBwZXJmZWN0IG1hdGNoXG4gICAgcmV0ID0gbGlzdC5zaGlmdCgpO1xuICB9IGVsc2Uge1xuICAgIC8vIHJlc3VsdCBzcGFucyBtb3JlIHRoYW4gb25lIGJ1ZmZlclxuICAgIHJldCA9IGhhc1N0cmluZ3MgPyBjb3B5RnJvbUJ1ZmZlclN0cmluZyhuLCBsaXN0KSA6IGNvcHlGcm9tQnVmZmVyKG4sIGxpc3QpO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8vIENvcGllcyBhIHNwZWNpZmllZCBhbW91bnQgb2YgY2hhcmFjdGVycyBmcm9tIHRoZSBsaXN0IG9mIGJ1ZmZlcmVkIGRhdGFcbi8vIGNodW5rcy5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgZGVzaWduZWQgdG8gYmUgaW5saW5hYmxlLCBzbyBwbGVhc2UgdGFrZSBjYXJlIHdoZW4gbWFraW5nXG4vLyBjaGFuZ2VzIHRvIHRoZSBmdW5jdGlvbiBib2R5LlxuZnVuY3Rpb24gY29weUZyb21CdWZmZXJTdHJpbmcobiwgbGlzdCkge1xuICB2YXIgcCA9IGxpc3QuaGVhZDtcbiAgdmFyIGMgPSAxO1xuICB2YXIgcmV0ID0gcC5kYXRhO1xuICBuIC09IHJldC5sZW5ndGg7XG4gIHdoaWxlIChwID0gcC5uZXh0KSB7XG4gICAgdmFyIHN0ciA9IHAuZGF0YTtcbiAgICB2YXIgbmIgPSBuID4gc3RyLmxlbmd0aCA/IHN0ci5sZW5ndGggOiBuO1xuICAgIGlmIChuYiA9PT0gc3RyLmxlbmd0aCkgcmV0ICs9IHN0cjtlbHNlIHJldCArPSBzdHIuc2xpY2UoMCwgbik7XG4gICAgbiAtPSBuYjtcbiAgICBpZiAobiA9PT0gMCkge1xuICAgICAgaWYgKG5iID09PSBzdHIubGVuZ3RoKSB7XG4gICAgICAgICsrYztcbiAgICAgICAgaWYgKHAubmV4dCkgbGlzdC5oZWFkID0gcC5uZXh0O2Vsc2UgbGlzdC5oZWFkID0gbGlzdC50YWlsID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QuaGVhZCA9IHA7XG4gICAgICAgIHAuZGF0YSA9IHN0ci5zbGljZShuYik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgKytjO1xuICB9XG4gIGxpc3QubGVuZ3RoIC09IGM7XG4gIHJldHVybiByZXQ7XG59XG5cbi8vIENvcGllcyBhIHNwZWNpZmllZCBhbW91bnQgb2YgYnl0ZXMgZnJvbSB0aGUgbGlzdCBvZiBidWZmZXJlZCBkYXRhIGNodW5rcy5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgZGVzaWduZWQgdG8gYmUgaW5saW5hYmxlLCBzbyBwbGVhc2UgdGFrZSBjYXJlIHdoZW4gbWFraW5nXG4vLyBjaGFuZ2VzIHRvIHRoZSBmdW5jdGlvbiBib2R5LlxuZnVuY3Rpb24gY29weUZyb21CdWZmZXIobiwgbGlzdCkge1xuICB2YXIgcmV0ID0gYnVmZmVyU2hpbS5hbGxvY1Vuc2FmZShuKTtcbiAgdmFyIHAgPSBsaXN0LmhlYWQ7XG4gIHZhciBjID0gMTtcbiAgcC5kYXRhLmNvcHkocmV0KTtcbiAgbiAtPSBwLmRhdGEubGVuZ3RoO1xuICB3aGlsZSAocCA9IHAubmV4dCkge1xuICAgIHZhciBidWYgPSBwLmRhdGE7XG4gICAgdmFyIG5iID0gbiA+IGJ1Zi5sZW5ndGggPyBidWYubGVuZ3RoIDogbjtcbiAgICBidWYuY29weShyZXQsIHJldC5sZW5ndGggLSBuLCAwLCBuYik7XG4gICAgbiAtPSBuYjtcbiAgICBpZiAobiA9PT0gMCkge1xuICAgICAgaWYgKG5iID09PSBidWYubGVuZ3RoKSB7XG4gICAgICAgICsrYztcbiAgICAgICAgaWYgKHAubmV4dCkgbGlzdC5oZWFkID0gcC5uZXh0O2Vsc2UgbGlzdC5oZWFkID0gbGlzdC50YWlsID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QuaGVhZCA9IHA7XG4gICAgICAgIHAuZGF0YSA9IGJ1Zi5zbGljZShuYik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgKytjO1xuICB9XG4gIGxpc3QubGVuZ3RoIC09IGM7XG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGVuZFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG5cbiAgLy8gSWYgd2UgZ2V0IGhlcmUgYmVmb3JlIGNvbnN1bWluZyBhbGwgdGhlIGJ5dGVzLCB0aGVuIHRoYXQgaXMgYVxuICAvLyBidWcgaW4gbm9kZS4gIFNob3VsZCBuZXZlciBoYXBwZW4uXG4gIGlmIChzdGF0ZS5sZW5ndGggPiAwKSB0aHJvdyBuZXcgRXJyb3IoJ1wiZW5kUmVhZGFibGUoKVwiIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhlbmRSZWFkYWJsZU5ULCBzdGF0ZSwgc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZU5UKHN0YXRlLCBzdHJlYW0pIHtcbiAgLy8gQ2hlY2sgdGhhdCB3ZSBkaWRuJ3QgZ2V0IG9uZSBsYXN0IHVuc2hpZnQuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICBzdGF0ZS5lbmRFbWl0dGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCh4cywgZikge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGYoeHNbaV0sIGkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluZGV4T2YoeHMsIHgpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBpZiAoeHNbaV0gPT09IHgpIHJldHVybiBpO1xuICB9XG4gIHJldHVybiAtMTtcbn0iLCIvLyBhIHRyYW5zZm9ybSBzdHJlYW0gaXMgYSByZWFkYWJsZS93cml0YWJsZSBzdHJlYW0gd2hlcmUgeW91IGRvXG4vLyBzb21ldGhpbmcgd2l0aCB0aGUgZGF0YS4gIFNvbWV0aW1lcyBpdCdzIGNhbGxlZCBhIFwiZmlsdGVyXCIsXG4vLyBidXQgdGhhdCdzIG5vdCBhIGdyZWF0IG5hbWUgZm9yIGl0LCBzaW5jZSB0aGF0IGltcGxpZXMgYSB0aGluZyB3aGVyZVxuLy8gc29tZSBiaXRzIHBhc3MgdGhyb3VnaCwgYW5kIG90aGVycyBhcmUgc2ltcGx5IGlnbm9yZWQuICAoVGhhdCB3b3VsZFxuLy8gYmUgYSB2YWxpZCBleGFtcGxlIG9mIGEgdHJhbnNmb3JtLCBvZiBjb3Vyc2UuKVxuLy9cbi8vIFdoaWxlIHRoZSBvdXRwdXQgaXMgY2F1c2FsbHkgcmVsYXRlZCB0byB0aGUgaW5wdXQsIGl0J3Mgbm90IGFcbi8vIG5lY2Vzc2FyaWx5IHN5bW1ldHJpYyBvciBzeW5jaHJvbm91cyB0cmFuc2Zvcm1hdGlvbi4gIEZvciBleGFtcGxlLFxuLy8gYSB6bGliIHN0cmVhbSBtaWdodCB0YWtlIG11bHRpcGxlIHBsYWluLXRleHQgd3JpdGVzKCksIGFuZCB0aGVuXG4vLyBlbWl0IGEgc2luZ2xlIGNvbXByZXNzZWQgY2h1bmsgc29tZSB0aW1lIGluIHRoZSBmdXR1cmUuXG4vL1xuLy8gSGVyZSdzIGhvdyB0aGlzIHdvcmtzOlxuLy9cbi8vIFRoZSBUcmFuc2Zvcm0gc3RyZWFtIGhhcyBhbGwgdGhlIGFzcGVjdHMgb2YgdGhlIHJlYWRhYmxlIGFuZCB3cml0YWJsZVxuLy8gc3RyZWFtIGNsYXNzZXMuICBXaGVuIHlvdSB3cml0ZShjaHVuayksIHRoYXQgY2FsbHMgX3dyaXRlKGNodW5rLGNiKVxuLy8gaW50ZXJuYWxseSwgYW5kIHJldHVybnMgZmFsc2UgaWYgdGhlcmUncyBhIGxvdCBvZiBwZW5kaW5nIHdyaXRlc1xuLy8gYnVmZmVyZWQgdXAuICBXaGVuIHlvdSBjYWxsIHJlYWQoKSwgdGhhdCBjYWxscyBfcmVhZChuKSB1bnRpbFxuLy8gdGhlcmUncyBlbm91Z2ggcGVuZGluZyByZWFkYWJsZSBkYXRhIGJ1ZmZlcmVkIHVwLlxuLy9cbi8vIEluIGEgdHJhbnNmb3JtIHN0cmVhbSwgdGhlIHdyaXR0ZW4gZGF0YSBpcyBwbGFjZWQgaW4gYSBidWZmZXIuICBXaGVuXG4vLyBfcmVhZChuKSBpcyBjYWxsZWQsIGl0IHRyYW5zZm9ybXMgdGhlIHF1ZXVlZCB1cCBkYXRhLCBjYWxsaW5nIHRoZVxuLy8gYnVmZmVyZWQgX3dyaXRlIGNiJ3MgYXMgaXQgY29uc3VtZXMgY2h1bmtzLiAgSWYgY29uc3VtaW5nIGEgc2luZ2xlXG4vLyB3cml0dGVuIGNodW5rIHdvdWxkIHJlc3VsdCBpbiBtdWx0aXBsZSBvdXRwdXQgY2h1bmtzLCB0aGVuIHRoZSBmaXJzdFxuLy8gb3V0cHV0dGVkIGJpdCBjYWxscyB0aGUgcmVhZGNiLCBhbmQgc3Vic2VxdWVudCBjaHVua3MganVzdCBnbyBpbnRvXG4vLyB0aGUgcmVhZCBidWZmZXIsIGFuZCB3aWxsIGNhdXNlIGl0IHRvIGVtaXQgJ3JlYWRhYmxlJyBpZiBuZWNlc3NhcnkuXG4vL1xuLy8gVGhpcyB3YXksIGJhY2stcHJlc3N1cmUgaXMgYWN0dWFsbHkgZGV0ZXJtaW5lZCBieSB0aGUgcmVhZGluZyBzaWRlLFxuLy8gc2luY2UgX3JlYWQgaGFzIHRvIGJlIGNhbGxlZCB0byBzdGFydCBwcm9jZXNzaW5nIGEgbmV3IGNodW5rLiAgSG93ZXZlcixcbi8vIGEgcGF0aG9sb2dpY2FsIGluZmxhdGUgdHlwZSBvZiB0cmFuc2Zvcm0gY2FuIGNhdXNlIGV4Y2Vzc2l2ZSBidWZmZXJpbmdcbi8vIGhlcmUuICBGb3IgZXhhbXBsZSwgaW1hZ2luZSBhIHN0cmVhbSB3aGVyZSBldmVyeSBieXRlIG9mIGlucHV0IGlzXG4vLyBpbnRlcnByZXRlZCBhcyBhbiBpbnRlZ2VyIGZyb20gMC0yNTUsIGFuZCB0aGVuIHJlc3VsdHMgaW4gdGhhdCBtYW55XG4vLyBieXRlcyBvZiBvdXRwdXQuICBXcml0aW5nIHRoZSA0IGJ5dGVzIHtmZixmZixmZixmZn0gd291bGQgcmVzdWx0IGluXG4vLyAxa2Igb2YgZGF0YSBiZWluZyBvdXRwdXQuICBJbiB0aGlzIGNhc2UsIHlvdSBjb3VsZCB3cml0ZSBhIHZlcnkgc21hbGxcbi8vIGFtb3VudCBvZiBpbnB1dCwgYW5kIGVuZCB1cCB3aXRoIGEgdmVyeSBsYXJnZSBhbW91bnQgb2Ygb3V0cHV0LiAgSW5cbi8vIHN1Y2ggYSBwYXRob2xvZ2ljYWwgaW5mbGF0aW5nIG1lY2hhbmlzbSwgdGhlcmUnZCBiZSBubyB3YXkgdG8gdGVsbFxuLy8gdGhlIHN5c3RlbSB0byBzdG9wIGRvaW5nIHRoZSB0cmFuc2Zvcm0uICBBIHNpbmdsZSA0TUIgd3JpdGUgY291bGRcbi8vIGNhdXNlIHRoZSBzeXN0ZW0gdG8gcnVuIG91dCBvZiBtZW1vcnkuXG4vL1xuLy8gSG93ZXZlciwgZXZlbiBpbiBzdWNoIGEgcGF0aG9sb2dpY2FsIGNhc2UsIG9ubHkgYSBzaW5nbGUgd3JpdHRlbiBjaHVua1xuLy8gd291bGQgYmUgY29uc3VtZWQsIGFuZCB0aGVuIHRoZSByZXN0IHdvdWxkIHdhaXQgKHVuLXRyYW5zZm9ybWVkKSB1bnRpbFxuLy8gdGhlIHJlc3VsdHMgb2YgdGhlIHByZXZpb3VzIHRyYW5zZm9ybWVkIGNodW5rIHdlcmUgY29uc3VtZWQuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBUcmFuc2Zvcm07XG5cbnZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudXRpbC5pbmhlcml0cyhUcmFuc2Zvcm0sIER1cGxleCk7XG5cbmZ1bmN0aW9uIFRyYW5zZm9ybVN0YXRlKHN0cmVhbSkge1xuICB0aGlzLmFmdGVyVHJhbnNmb3JtID0gZnVuY3Rpb24gKGVyLCBkYXRhKSB7XG4gICAgcmV0dXJuIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpO1xuICB9O1xuXG4gIHRoaXMubmVlZFRyYW5zZm9ybSA9IGZhbHNlO1xuICB0aGlzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuICB0aGlzLndyaXRlY2h1bmsgPSBudWxsO1xuICB0aGlzLndyaXRlZW5jb2RpbmcgPSBudWxsO1xufVxuXG5mdW5jdGlvbiBhZnRlclRyYW5zZm9ybShzdHJlYW0sIGVyLCBkYXRhKSB7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG4gIHRzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuXG4gIHZhciBjYiA9IHRzLndyaXRlY2I7XG5cbiAgaWYgKCFjYikgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignbm8gd3JpdGVjYiBpbiBUcmFuc2Zvcm0gY2xhc3MnKSk7XG5cbiAgdHMud3JpdGVjaHVuayA9IG51bGw7XG4gIHRzLndyaXRlY2IgPSBudWxsO1xuXG4gIGlmIChkYXRhICE9PSBudWxsICYmIGRhdGEgIT09IHVuZGVmaW5lZCkgc3RyZWFtLnB1c2goZGF0YSk7XG5cbiAgY2IoZXIpO1xuXG4gIHZhciBycyA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgcnMucmVhZGluZyA9IGZhbHNlO1xuICBpZiAocnMubmVlZFJlYWRhYmxlIHx8IHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspIHtcbiAgICBzdHJlYW0uX3JlYWQocnMuaGlnaFdhdGVyTWFyayk7XG4gIH1cbn1cblxuZnVuY3Rpb24gVHJhbnNmb3JtKG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFRyYW5zZm9ybSkpIHJldHVybiBuZXcgVHJhbnNmb3JtKG9wdGlvbnMpO1xuXG4gIER1cGxleC5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlID0gbmV3IFRyYW5zZm9ybVN0YXRlKHRoaXMpO1xuXG4gIC8vIHdoZW4gdGhlIHdyaXRhYmxlIHNpZGUgZmluaXNoZXMsIHRoZW4gZmx1c2ggb3V0IGFueXRoaW5nIHJlbWFpbmluZy5cbiAgdmFyIHN0cmVhbSA9IHRoaXM7XG5cbiAgLy8gc3RhcnQgb3V0IGFza2luZyBmb3IgYSByZWFkYWJsZSBldmVudCBvbmNlIGRhdGEgaXMgdHJhbnNmb3JtZWQuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyB3ZSBoYXZlIGltcGxlbWVudGVkIHRoZSBfcmVhZCBtZXRob2QsIGFuZCBkb25lIHRoZSBvdGhlciB0aGluZ3NcbiAgLy8gdGhhdCBSZWFkYWJsZSB3YW50cyBiZWZvcmUgdGhlIGZpcnN0IF9yZWFkIGNhbGwsIHNvIHVuc2V0IHRoZVxuICAvLyBzeW5jIGd1YXJkIGZsYWcuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuc3luYyA9IGZhbHNlO1xuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnRyYW5zZm9ybSA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5fdHJhbnNmb3JtID0gb3B0aW9ucy50cmFuc2Zvcm07XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmx1c2ggPT09ICdmdW5jdGlvbicpIHRoaXMuX2ZsdXNoID0gb3B0aW9ucy5mbHVzaDtcbiAgfVxuXG4gIHRoaXMub25jZSgncHJlZmluaXNoJywgZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5fZmx1c2ggPT09ICdmdW5jdGlvbicpIHRoaXMuX2ZsdXNoKGZ1bmN0aW9uIChlcikge1xuICAgICAgZG9uZShzdHJlYW0sIGVyKTtcbiAgICB9KTtlbHNlIGRvbmUoc3RyZWFtKTtcbiAgfSk7XG59XG5cblRyYW5zZm9ybS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcpIHtcbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUubmVlZFRyYW5zZm9ybSA9IGZhbHNlO1xuICByZXR1cm4gRHVwbGV4LnByb3RvdHlwZS5wdXNoLmNhbGwodGhpcywgY2h1bmssIGVuY29kaW5nKTtcbn07XG5cbi8vIFRoaXMgaXMgdGhlIHBhcnQgd2hlcmUgeW91IGRvIHN0dWZmIVxuLy8gb3ZlcnJpZGUgdGhpcyBmdW5jdGlvbiBpbiBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gJ2NodW5rJyBpcyBhbiBpbnB1dCBjaHVuay5cbi8vXG4vLyBDYWxsIGBwdXNoKG5ld0NodW5rKWAgdG8gcGFzcyBhbG9uZyB0cmFuc2Zvcm1lZCBvdXRwdXRcbi8vIHRvIHRoZSByZWFkYWJsZSBzaWRlLiAgWW91IG1heSBjYWxsICdwdXNoJyB6ZXJvIG9yIG1vcmUgdGltZXMuXG4vL1xuLy8gQ2FsbCBgY2IoZXJyKWAgd2hlbiB5b3UgYXJlIGRvbmUgd2l0aCB0aGlzIGNodW5rLiAgSWYgeW91IHBhc3Ncbi8vIGFuIGVycm9yLCB0aGVuIHRoYXQnbGwgcHV0IHRoZSBodXJ0IG9uIHRoZSB3aG9sZSBvcGVyYXRpb24uICBJZiB5b3Vcbi8vIG5ldmVyIGNhbGwgY2IoKSwgdGhlbiB5b3UnbGwgbmV2ZXIgZ2V0IGFub3RoZXIgY2h1bmsuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl90cmFuc2Zvcm0gPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZCcpO1xufTtcblxuVHJhbnNmb3JtLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMud3JpdGVjYiA9IGNiO1xuICB0cy53cml0ZWNodW5rID0gY2h1bms7XG4gIHRzLndyaXRlZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgaWYgKCF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB2YXIgcnMgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICAgIGlmICh0cy5uZWVkVHJhbnNmb3JtIHx8IHJzLm5lZWRSZWFkYWJsZSB8fCBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKSB0aGlzLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59O1xuXG4vLyBEb2Vzbid0IG1hdHRlciB3aGF0IHRoZSBhcmdzIGFyZSBoZXJlLlxuLy8gX3RyYW5zZm9ybSBkb2VzIGFsbCB0aGUgd29yay5cbi8vIFRoYXQgd2UgZ290IGhlcmUgbWVhbnMgdGhhdCB0aGUgcmVhZGFibGUgc2lkZSB3YW50cyBtb3JlIGRhdGEuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24gKG4pIHtcbiAgdmFyIHRzID0gdGhpcy5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHRzLndyaXRlY2h1bmsgIT09IG51bGwgJiYgdHMud3JpdGVjYiAmJiAhdHMudHJhbnNmb3JtaW5nKSB7XG4gICAgdHMudHJhbnNmb3JtaW5nID0gdHJ1ZTtcbiAgICB0aGlzLl90cmFuc2Zvcm0odHMud3JpdGVjaHVuaywgdHMud3JpdGVlbmNvZGluZywgdHMuYWZ0ZXJUcmFuc2Zvcm0pO1xuICB9IGVsc2Uge1xuICAgIC8vIG1hcmsgdGhhdCB3ZSBuZWVkIGEgdHJhbnNmb3JtLCBzbyB0aGF0IGFueSBkYXRhIHRoYXQgY29tZXMgaW5cbiAgICAvLyB3aWxsIGdldCBwcm9jZXNzZWQsIG5vdyB0aGF0IHdlJ3ZlIGFza2VkIGZvciBpdC5cbiAgICB0cy5uZWVkVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZG9uZShzdHJlYW0sIGVyKSB7XG4gIGlmIChlcikgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcblxuICAvLyBpZiB0aGVyZSdzIG5vdGhpbmcgaW4gdGhlIHdyaXRlIGJ1ZmZlciwgdGhlbiB0aGF0IG1lYW5zXG4gIC8vIHRoYXQgbm90aGluZyBtb3JlIHdpbGwgZXZlciBiZSBwcm92aWRlZFxuICB2YXIgd3MgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHdzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdDYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gd3MubGVuZ3RoICE9IDAnKTtcblxuICBpZiAodHMudHJhbnNmb3JtaW5nKSB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiBzdGlsbCB0cmFuc2Zvcm1pbmcnKTtcblxuICByZXR1cm4gc3RyZWFtLnB1c2gobnVsbCk7XG59IiwiLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIGNiKSwgYW5kIGl0J2xsIGhhbmRsZSBhbGxcbi8vIHRoZSBkcmFpbiBldmVudCBlbWlzc2lvbiBhbmQgYnVmZmVyaW5nLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGFzeW5jV3JpdGUgPSAhcHJvY2Vzcy5icm93c2VyICYmIFsndjAuMTAnLCAndjAuOS4nXS5pbmRleE9mKHByb2Nlc3MudmVyc2lvbi5zbGljZSgwLCA1KSkgPiAtMSA/IHNldEltbWVkaWF0ZSA6IHByb2Nlc3NOZXh0VGljaztcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5Xcml0YWJsZS5Xcml0YWJsZVN0YXRlID0gV3JpdGFibGVTdGF0ZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGludGVybmFsVXRpbCA9IHtcbiAgZGVwcmVjYXRlOiByZXF1aXJlKCd1dGlsLWRlcHJlY2F0ZScpXG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgU3RyZWFtO1xuKGZ1bmN0aW9uICgpIHtcbiAgdHJ5IHtcbiAgICBTdHJlYW0gPSByZXF1aXJlKCdzdCcgKyAncmVhbScpO1xuICB9IGNhdGNoIChfKSB7fSBmaW5hbGx5IHtcbiAgICBpZiAoIVN0cmVhbSkgU3RyZWFtID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuICB9XG59KSgpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGJ1ZmZlclNoaW0gPSByZXF1aXJlKCdidWZmZXItc2hpbXMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFdyaXRhYmxlLCBTdHJlYW0pO1xuXG5mdW5jdGlvbiBub3AoKSB7fVxuXG5mdW5jdGlvbiBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHRoaXMuY2h1bmsgPSBjaHVuaztcbiAgdGhpcy5lbmNvZGluZyA9IGVuY29kaW5nO1xuICB0aGlzLmNhbGxiYWNrID0gY2I7XG4gIHRoaXMubmV4dCA9IG51bGw7XG59XG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBXcml0YWJsZVN0YXRlKG9wdGlvbnMsIHN0cmVhbSkge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIG9iamVjdCBzdHJlYW0gZmxhZyB0byBpbmRpY2F0ZSB3aGV0aGVyIG9yIG5vdCB0aGlzIHN0cmVhbVxuICAvLyBjb250YWlucyBidWZmZXJzIG9yIG9iamVjdHMuXG4gIHRoaXMub2JqZWN0TW9kZSA9ICEhb3B0aW9ucy5vYmplY3RNb2RlO1xuXG4gIGlmIChzdHJlYW0gaW5zdGFuY2VvZiBEdXBsZXgpIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMud3JpdGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCB3cml0ZSgpIHN0YXJ0cyByZXR1cm5pbmcgZmFsc2VcbiAgLy8gTm90ZTogMCBpcyBhIHZhbGlkIHZhbHVlLCBtZWFucyB0aGF0IHdlIGFsd2F5cyByZXR1cm4gZmFsc2UgaWZcbiAgLy8gdGhlIGVudGlyZSBidWZmZXIgaXMgbm90IGZsdXNoZWQgaW1tZWRpYXRlbHkgb24gd3JpdGUoKVxuICB2YXIgaHdtID0gb3B0aW9ucy5oaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSBod20gfHwgaHdtID09PSAwID8gaHdtIDogZGVmYXVsdEh3bTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH4gfnRoaXMuaGlnaFdhdGVyTWFyaztcblxuICB0aGlzLm5lZWREcmFpbiA9IGZhbHNlO1xuICAvLyBhdCB0aGUgc3RhcnQgb2YgY2FsbGluZyBlbmQoKVxuICB0aGlzLmVuZGluZyA9IGZhbHNlO1xuICAvLyB3aGVuIGVuZCgpIGhhcyBiZWVuIGNhbGxlZCwgYW5kIHJldHVybmVkXG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgLy8gd2hlbiAnZmluaXNoJyBpcyBlbWl0dGVkXG4gIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBzaG91bGQgd2UgZGVjb2RlIHN0cmluZ3MgaW50byBidWZmZXJzIGJlZm9yZSBwYXNzaW5nIHRvIF93cml0ZT9cbiAgLy8gdGhpcyBpcyBoZXJlIHNvIHRoYXQgc29tZSBub2RlLWNvcmUgc3RyZWFtcyBjYW4gb3B0aW1pemUgc3RyaW5nXG4gIC8vIGhhbmRsaW5nIGF0IGEgbG93ZXIgbGV2ZWwuXG4gIHZhciBub0RlY29kZSA9IG9wdGlvbnMuZGVjb2RlU3RyaW5ncyA9PT0gZmFsc2U7XG4gIHRoaXMuZGVjb2RlU3RyaW5ncyA9ICFub0RlY29kZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyBub3QgYW4gYWN0dWFsIGJ1ZmZlciB3ZSBrZWVwIHRyYWNrIG9mLCBidXQgYSBtZWFzdXJlbWVudFxuICAvLyBvZiBob3cgbXVjaCB3ZSdyZSB3YWl0aW5nIHRvIGdldCBwdXNoZWQgdG8gc29tZSB1bmRlcmx5aW5nXG4gIC8vIHNvY2tldCBvciBmaWxlLlxuICB0aGlzLmxlbmd0aCA9IDA7XG5cbiAgLy8gYSBmbGFnIHRvIHNlZSB3aGVuIHdlJ3JlIGluIHRoZSBtaWRkbGUgb2YgYSB3cml0ZS5cbiAgdGhpcy53cml0aW5nID0gZmFsc2U7XG5cbiAgLy8gd2hlbiB0cnVlIGFsbCB3cml0ZXMgd2lsbCBiZSBidWZmZXJlZCB1bnRpbCAudW5jb3JrKCkgY2FsbFxuICB0aGlzLmNvcmtlZCA9IDA7XG5cbiAgLy8gYSBmbGFnIHRvIGJlIGFibGUgdG8gdGVsbCBpZiB0aGUgb253cml0ZSBjYiBpcyBjYWxsZWQgaW1tZWRpYXRlbHksXG4gIC8vIG9yIG9uIGEgbGF0ZXIgdGljay4gIFdlIHNldCB0aGlzIHRvIHRydWUgYXQgZmlyc3QsIGJlY2F1c2UgYW55XG4gIC8vIGFjdGlvbnMgdGhhdCBzaG91bGRuJ3QgaGFwcGVuIHVudGlsIFwibGF0ZXJcIiBzaG91bGQgZ2VuZXJhbGx5IGFsc29cbiAgLy8gbm90IGhhcHBlbiBiZWZvcmUgdGhlIGZpcnN0IHdyaXRlIGNhbGwuXG4gIHRoaXMuc3luYyA9IHRydWU7XG5cbiAgLy8gYSBmbGFnIHRvIGtub3cgaWYgd2UncmUgcHJvY2Vzc2luZyBwcmV2aW91c2x5IGJ1ZmZlcmVkIGl0ZW1zLCB3aGljaFxuICAvLyBtYXkgY2FsbCB0aGUgX3dyaXRlKCkgY2FsbGJhY2sgaW4gdGhlIHNhbWUgdGljaywgc28gdGhhdCB3ZSBkb24ndFxuICAvLyBlbmQgdXAgaW4gYW4gb3ZlcmxhcHBlZCBvbndyaXRlIHNpdHVhdGlvbi5cbiAgdGhpcy5idWZmZXJQcm9jZXNzaW5nID0gZmFsc2U7XG5cbiAgLy8gdGhlIGNhbGxiYWNrIHRoYXQncyBwYXNzZWQgdG8gX3dyaXRlKGNodW5rLGNiKVxuICB0aGlzLm9ud3JpdGUgPSBmdW5jdGlvbiAoZXIpIHtcbiAgICBvbndyaXRlKHN0cmVhbSwgZXIpO1xuICB9O1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0IHRoZSB1c2VyIHN1cHBsaWVzIHRvIHdyaXRlKGNodW5rLGVuY29kaW5nLGNiKVxuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuXG4gIC8vIHRoZSBhbW91bnQgdGhhdCBpcyBiZWluZyB3cml0dGVuIHdoZW4gX3dyaXRlIGlzIGNhbGxlZC5cbiAgdGhpcy53cml0ZWxlbiA9IDA7XG5cbiAgdGhpcy5idWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB0aGlzLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuXG4gIC8vIG51bWJlciBvZiBwZW5kaW5nIHVzZXItc3VwcGxpZWQgd3JpdGUgY2FsbGJhY2tzXG4gIC8vIHRoaXMgbXVzdCBiZSAwIGJlZm9yZSAnZmluaXNoJyBjYW4gYmUgZW1pdHRlZFxuICB0aGlzLnBlbmRpbmdjYiA9IDA7XG5cbiAgLy8gZW1pdCBwcmVmaW5pc2ggaWYgdGhlIG9ubHkgdGhpbmcgd2UncmUgd2FpdGluZyBmb3IgaXMgX3dyaXRlIGNic1xuICAvLyBUaGlzIGlzIHJlbGV2YW50IGZvciBzeW5jaHJvbm91cyBUcmFuc2Zvcm0gc3RyZWFtc1xuICB0aGlzLnByZWZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gVHJ1ZSBpZiB0aGUgZXJyb3Igd2FzIGFscmVhZHkgZW1pdHRlZCBhbmQgc2hvdWxkIG5vdCBiZSB0aHJvd24gYWdhaW5cbiAgdGhpcy5lcnJvckVtaXR0ZWQgPSBmYWxzZTtcblxuICAvLyBjb3VudCBidWZmZXJlZCByZXF1ZXN0c1xuICB0aGlzLmJ1ZmZlcmVkUmVxdWVzdENvdW50ID0gMDtcblxuICAvLyBhbGxvY2F0ZSB0aGUgZmlyc3QgQ29ya2VkUmVxdWVzdCwgdGhlcmUgaXMgYWx3YXlzXG4gIC8vIG9uZSBhbGxvY2F0ZWQgYW5kIGZyZWUgdG8gdXNlLCBhbmQgd2UgbWFpbnRhaW4gYXQgbW9zdCB0d29cbiAgdGhpcy5jb3JrZWRSZXF1ZXN0c0ZyZWUgPSBuZXcgQ29ya2VkUmVxdWVzdCh0aGlzKTtcbn1cblxuV3JpdGFibGVTdGF0ZS5wcm90b3R5cGUuZ2V0QnVmZmVyID0gZnVuY3Rpb24gd3JpdGFibGVTdGF0ZUdldEJ1ZmZlcigpIHtcbiAgdmFyIGN1cnJlbnQgPSB0aGlzLmJ1ZmZlcmVkUmVxdWVzdDtcbiAgdmFyIG91dCA9IFtdO1xuICB3aGlsZSAoY3VycmVudCkge1xuICAgIG91dC5wdXNoKGN1cnJlbnQpO1xuICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbihmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFdyaXRhYmxlU3RhdGUucHJvdG90eXBlLCAnYnVmZmVyJywge1xuICAgICAgZ2V0OiBpbnRlcm5hbFV0aWwuZGVwcmVjYXRlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyKCk7XG4gICAgICB9LCAnX3dyaXRhYmxlU3RhdGUuYnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBfd3JpdGFibGVTdGF0ZS5nZXRCdWZmZXIgJyArICdpbnN0ZWFkLicpXG4gICAgfSk7XG4gIH0gY2F0Y2ggKF8pIHt9XG59KSgpO1xuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gV3JpdGFibGUob3B0aW9ucykge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIC8vIFdyaXRhYmxlIGN0b3IgaXMgYXBwbGllZCB0byBEdXBsZXhlcywgdGhvdWdoIHRoZXkncmUgbm90XG4gIC8vIGluc3RhbmNlb2YgV3JpdGFibGUsIHRoZXkncmUgaW5zdGFuY2VvZiBSZWFkYWJsZS5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFdyaXRhYmxlKSAmJiAhKHRoaXMgaW5zdGFuY2VvZiBEdXBsZXgpKSByZXR1cm4gbmV3IFdyaXRhYmxlKG9wdGlvbnMpO1xuXG4gIHRoaXMuX3dyaXRhYmxlU3RhdGUgPSBuZXcgV3JpdGFibGVTdGF0ZShvcHRpb25zLCB0aGlzKTtcblxuICAvLyBsZWdhY3kuXG4gIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLndyaXRlID09PSAnZnVuY3Rpb24nKSB0aGlzLl93cml0ZSA9IG9wdGlvbnMud3JpdGU7XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMud3JpdGV2ID09PSAnZnVuY3Rpb24nKSB0aGlzLl93cml0ZXYgPSBvcHRpb25zLndyaXRldjtcbiAgfVxuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBPdGhlcndpc2UgcGVvcGxlIGNhbiBwaXBlIFdyaXRhYmxlIHN0cmVhbXMsIHdoaWNoIGlzIGp1c3Qgd3JvbmcuXG5Xcml0YWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQ2Fubm90IHBpcGUsIG5vdCByZWFkYWJsZScpKTtcbn07XG5cbmZ1bmN0aW9uIHdyaXRlQWZ0ZXJFbmQoc3RyZWFtLCBjYikge1xuICB2YXIgZXIgPSBuZXcgRXJyb3IoJ3dyaXRlIGFmdGVyIGVuZCcpO1xuICAvLyBUT0RPOiBkZWZlciBlcnJvciBldmVudHMgY29uc2lzdGVudGx5IGV2ZXJ5d2hlcmUsIG5vdCBqdXN0IHRoZSBjYlxuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xufVxuXG4vLyBJZiB3ZSBnZXQgc29tZXRoaW5nIHRoYXQgaXMgbm90IGEgYnVmZmVyLCBzdHJpbmcsIG51bGwsIG9yIHVuZGVmaW5lZCxcbi8vIGFuZCB3ZSdyZSBub3QgaW4gb2JqZWN0TW9kZSwgdGhlbiB0aGF0J3MgYW4gZXJyb3IuXG4vLyBPdGhlcndpc2Ugc3RyZWFtIGNodW5rcyBhcmUgYWxsIGNvbnNpZGVyZWQgdG8gYmUgb2YgbGVuZ3RoPTEsIGFuZCB0aGVcbi8vIHdhdGVybWFya3MgZGV0ZXJtaW5lIGhvdyBtYW55IG9iamVjdHMgdG8ga2VlcCBpbiB0aGUgYnVmZmVyLCByYXRoZXIgdGhhblxuLy8gaG93IG1hbnkgYnl0ZXMgb3IgY2hhcmFjdGVycy5cbmZ1bmN0aW9uIHZhbGlkQ2h1bmsoc3RyZWFtLCBzdGF0ZSwgY2h1bmssIGNiKSB7XG4gIHZhciB2YWxpZCA9IHRydWU7XG4gIHZhciBlciA9IGZhbHNlO1xuICAvLyBBbHdheXMgdGhyb3cgZXJyb3IgaWYgYSBudWxsIGlzIHdyaXR0ZW5cbiAgLy8gaWYgd2UgYXJlIG5vdCBpbiBvYmplY3QgbW9kZSB0aGVuIHRocm93XG4gIC8vIGlmIGl0IGlzIG5vdCBhIGJ1ZmZlciwgc3RyaW5nLCBvciB1bmRlZmluZWQuXG4gIGlmIChjaHVuayA9PT0gbnVsbCkge1xuICAgIGVyID0gbmV3IFR5cGVFcnJvcignTWF5IG5vdCB3cml0ZSBudWxsIHZhbHVlcyB0byBzdHJlYW0nKTtcbiAgfSBlbHNlIGlmICghQnVmZmVyLmlzQnVmZmVyKGNodW5rKSAmJiB0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmIGNodW5rICE9PSB1bmRlZmluZWQgJiYgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgfVxuICBpZiAoZXIpIHtcbiAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gICAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG4gICAgdmFsaWQgPSBmYWxzZTtcbiAgfVxuICByZXR1cm4gdmFsaWQ7XG59XG5cbldyaXRhYmxlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG4gIHZhciByZXQgPSBmYWxzZTtcblxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSkgZW5jb2RpbmcgPSAnYnVmZmVyJztlbHNlIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuXG4gIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpIGNiID0gbm9wO1xuXG4gIGlmIChzdGF0ZS5lbmRlZCkgd3JpdGVBZnRlckVuZCh0aGlzLCBjYik7ZWxzZSBpZiAodmFsaWRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssIGNiKSkge1xuICAgIHN0YXRlLnBlbmRpbmdjYisrO1xuICAgIHJldCA9IHdyaXRlT3JCdWZmZXIodGhpcywgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5jb3JrID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIHN0YXRlLmNvcmtlZCsrO1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLnVuY29yayA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkLS07XG5cbiAgICBpZiAoIXN0YXRlLndyaXRpbmcgJiYgIXN0YXRlLmNvcmtlZCAmJiAhc3RhdGUuZmluaXNoZWQgJiYgIXN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgJiYgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0KSBjbGVhckJ1ZmZlcih0aGlzLCBzdGF0ZSk7XG4gIH1cbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5zZXREZWZhdWx0RW5jb2RpbmcgPSBmdW5jdGlvbiBzZXREZWZhdWx0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgLy8gbm9kZTo6UGFyc2VFbmNvZGluZygpIHJlcXVpcmVzIGxvd2VyIGNhc2UuXG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnKSBlbmNvZGluZyA9IGVuY29kaW5nLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghKFsnaGV4JywgJ3V0ZjgnLCAndXRmLTgnLCAnYXNjaWknLCAnYmluYXJ5JywgJ2Jhc2U2NCcsICd1Y3MyJywgJ3Vjcy0yJywgJ3V0ZjE2bGUnLCAndXRmLTE2bGUnLCAncmF3J10uaW5kZXhPZigoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKSkgPiAtMSkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XG4gIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVmYXVsdEVuY29kaW5nID0gZW5jb2Rpbmc7XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZykge1xuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgc3RhdGUuZGVjb2RlU3RyaW5ncyAhPT0gZmFsc2UgJiYgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJykge1xuICAgIGNodW5rID0gYnVmZmVyU2hpbS5mcm9tKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICBzdGF0ZS5sZW5ndGggKz0gbGVuO1xuXG4gIHZhciByZXQgPSBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrO1xuICAvLyB3ZSBtdXN0IGVuc3VyZSB0aGF0IHByZXZpb3VzIG5lZWREcmFpbiB3aWxsIG5vdCBiZSByZXNldCB0byBmYWxzZS5cbiAgaWYgKCFyZXQpIHN0YXRlLm5lZWREcmFpbiA9IHRydWU7XG5cbiAgaWYgKHN0YXRlLndyaXRpbmcgfHwgc3RhdGUuY29ya2VkKSB7XG4gICAgdmFyIGxhc3QgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBuZXcgV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYik7XG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIGxhc3QubmV4dCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfVxuICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdENvdW50ICs9IDE7XG4gIH0gZWxzZSB7XG4gICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgd3JpdGV2LCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgc3RhdGUud3JpdGVsZW4gPSBsZW47XG4gIHN0YXRlLndyaXRlY2IgPSBjYjtcbiAgc3RhdGUud3JpdGluZyA9IHRydWU7XG4gIHN0YXRlLnN5bmMgPSB0cnVlO1xuICBpZiAod3JpdGV2KSBzdHJlYW0uX3dyaXRldihjaHVuaywgc3RhdGUub253cml0ZSk7ZWxzZSBzdHJlYW0uX3dyaXRlKGNodW5rLCBlbmNvZGluZywgc3RhdGUub253cml0ZSk7XG4gIHN0YXRlLnN5bmMgPSBmYWxzZTtcbn1cblxuZnVuY3Rpb24gb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYikge1xuICAtLXN0YXRlLnBlbmRpbmdjYjtcbiAgaWYgKHN5bmMpIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO2Vsc2UgY2IoZXIpO1xuXG4gIHN0cmVhbS5fd3JpdGFibGVTdGF0ZS5lcnJvckVtaXR0ZWQgPSB0cnVlO1xuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSkge1xuICBzdGF0ZS53cml0aW5nID0gZmFsc2U7XG4gIHN0YXRlLndyaXRlY2IgPSBudWxsO1xuICBzdGF0ZS5sZW5ndGggLT0gc3RhdGUud3JpdGVsZW47XG4gIHN0YXRlLndyaXRlbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gb253cml0ZShzdHJlYW0sIGVyKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHN5bmMgPSBzdGF0ZS5zeW5jO1xuICB2YXIgY2IgPSBzdGF0ZS53cml0ZWNiO1xuXG4gIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSk7XG5cbiAgaWYgKGVyKSBvbndyaXRlRXJyb3Ioc3RyZWFtLCBzdGF0ZSwgc3luYywgZXIsIGNiKTtlbHNlIHtcbiAgICAvLyBDaGVjayBpZiB3ZSdyZSBhY3R1YWxseSByZWFkeSB0byBmaW5pc2gsIGJ1dCBkb24ndCBlbWl0IHlldFxuICAgIHZhciBmaW5pc2hlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuXG4gICAgaWYgKCFmaW5pc2hlZCAmJiAhc3RhdGUuY29ya2VkICYmICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCkge1xuICAgICAgY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYgKHN5bmMpIHtcbiAgICAgIC8qPHJlcGxhY2VtZW50PiovXG4gICAgICBhc3luY1dyaXRlKGFmdGVyV3JpdGUsIHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgICAvKjwvcmVwbGFjZW1lbnQ+Ki9cbiAgICB9IGVsc2Uge1xuICAgICAgICBhZnRlcldyaXRlKHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpIHtcbiAgaWYgKCFmaW5pc2hlZCkgb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpO1xuICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgY2IoKTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG59XG5cbi8vIE11c3QgZm9yY2UgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIG9uIG5leHRUaWNrLCBzbyB0aGF0IHdlIGRvbid0XG4vLyBlbWl0ICdkcmFpbicgYmVmb3JlIHRoZSB3cml0ZSgpIGNvbnN1bWVyIGdldHMgdGhlICdmYWxzZScgcmV0dXJuXG4vLyB2YWx1ZSwgYW5kIGhhcyBhIGNoYW5jZSB0byBhdHRhY2ggYSAnZHJhaW4nIGxpc3RlbmVyLlxuZnVuY3Rpb24gb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5uZWVkRHJhaW4pIHtcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZHJhaW4nKTtcbiAgfVxufVxuXG4vLyBpZiB0aGVyZSdzIHNvbWV0aGluZyBpbiB0aGUgYnVmZmVyIHdhaXRpbmcsIHRoZW4gcHJvY2VzcyBpdFxuZnVuY3Rpb24gY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSkge1xuICBzdGF0ZS5idWZmZXJQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgdmFyIGVudHJ5ID0gc3RhdGUuYnVmZmVyZWRSZXF1ZXN0O1xuXG4gIGlmIChzdHJlYW0uX3dyaXRldiAmJiBlbnRyeSAmJiBlbnRyeS5uZXh0KSB7XG4gICAgLy8gRmFzdCBjYXNlLCB3cml0ZSBldmVyeXRoaW5nIHVzaW5nIF93cml0ZXYoKVxuICAgIHZhciBsID0gc3RhdGUuYnVmZmVyZWRSZXF1ZXN0Q291bnQ7XG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheShsKTtcbiAgICB2YXIgaG9sZGVyID0gc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlO1xuICAgIGhvbGRlci5lbnRyeSA9IGVudHJ5O1xuXG4gICAgdmFyIGNvdW50ID0gMDtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGJ1ZmZlcltjb3VudF0gPSBlbnRyeTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICAgIGNvdW50ICs9IDE7XG4gICAgfVxuXG4gICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCB0cnVlLCBzdGF0ZS5sZW5ndGgsIGJ1ZmZlciwgJycsIGhvbGRlci5maW5pc2gpO1xuXG4gICAgLy8gZG9Xcml0ZSBpcyBhbG1vc3QgYWx3YXlzIGFzeW5jLCBkZWZlciB0aGVzZSB0byBzYXZlIGEgYml0IG9mIHRpbWVcbiAgICAvLyBhcyB0aGUgaG90IHBhdGggZW5kcyB3aXRoIGRvV3JpdGVcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICBpZiAoaG9sZGVyLm5leHQpIHtcbiAgICAgIHN0YXRlLmNvcmtlZFJlcXVlc3RzRnJlZSA9IGhvbGRlci5uZXh0O1xuICAgICAgaG9sZGVyLm5leHQgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5jb3JrZWRSZXF1ZXN0c0ZyZWUgPSBuZXcgQ29ya2VkUmVxdWVzdChzdGF0ZSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIFNsb3cgY2FzZSwgd3JpdGUgY2h1bmtzIG9uZS1ieS1vbmVcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIHZhciBjaHVuayA9IGVudHJ5LmNodW5rO1xuICAgICAgdmFyIGVuY29kaW5nID0gZW50cnkuZW5jb2Rpbmc7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICAgICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICAgIC8vIGlmIHdlIGRpZG4ndCBjYWxsIHRoZSBvbndyaXRlIGltbWVkaWF0ZWx5LCB0aGVuXG4gICAgICAvLyBpdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gd2FpdCB1bnRpbCBpdCBkb2VzLlxuICAgICAgLy8gYWxzbywgdGhhdCBtZWFucyB0aGF0IHRoZSBjaHVuayBhbmQgY2IgYXJlIGN1cnJlbnRseVxuICAgICAgLy8gYmVpbmcgcHJvY2Vzc2VkLCBzbyBtb3ZlIHRoZSBidWZmZXIgY291bnRlciBwYXN0IHRoZW0uXG4gICAgICBpZiAoc3RhdGUud3JpdGluZykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZW50cnkgPT09IG51bGwpIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB9XG5cbiAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0Q291bnQgPSAwO1xuICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPSBlbnRyeTtcbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24gKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRldiA9IG51bGw7XG5cbldyaXRhYmxlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmICh0eXBlb2YgY2h1bmsgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGNodW5rO1xuICAgIGNodW5rID0gbnVsbDtcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBpZiAoY2h1bmsgIT09IG51bGwgJiYgY2h1bmsgIT09IHVuZGVmaW5lZCkgdGhpcy53cml0ZShjaHVuaywgZW5jb2RpbmcpO1xuXG4gIC8vIC5lbmQoKSBmdWxseSB1bmNvcmtzXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQgPSAxO1xuICAgIHRoaXMudW5jb3JrKCk7XG4gIH1cblxuICAvLyBpZ25vcmUgdW5uZWNlc3NhcnkgZW5kKCkgY2FsbHMuXG4gIGlmICghc3RhdGUuZW5kaW5nICYmICFzdGF0ZS5maW5pc2hlZCkgZW5kV3JpdGFibGUodGhpcywgc3RhdGUsIGNiKTtcbn07XG5cbmZ1bmN0aW9uIG5lZWRGaW5pc2goc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlLmVuZGluZyAmJiBzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID09PSBudWxsICYmICFzdGF0ZS5maW5pc2hlZCAmJiAhc3RhdGUud3JpdGluZztcbn1cblxuZnVuY3Rpb24gcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5wcmVmaW5pc2hlZCkge1xuICAgIHN0YXRlLnByZWZpbmlzaGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0uZW1pdCgncHJlZmluaXNoJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbmVlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZCkgcHJvY2Vzc05leHRUaWNrKGNiKTtlbHNlIHN0cmVhbS5vbmNlKCdmaW5pc2gnLCBjYik7XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICBzdHJlYW0ud3JpdGFibGUgPSBmYWxzZTtcbn1cblxuLy8gSXQgc2VlbXMgYSBsaW5rZWQgbGlzdCBidXQgaXQgaXMgbm90XG4vLyB0aGVyZSB3aWxsIGJlIG9ubHkgMiBvZiB0aGVzZSBmb3IgZWFjaCBzdHJlYW1cbmZ1bmN0aW9uIENvcmtlZFJlcXVlc3Qoc3RhdGUpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm5leHQgPSBudWxsO1xuICB0aGlzLmVudHJ5ID0gbnVsbDtcblxuICB0aGlzLmZpbmlzaCA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICB2YXIgZW50cnkgPSBfdGhpcy5lbnRyeTtcbiAgICBfdGhpcy5lbnRyeSA9IG51bGw7XG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHN0YXRlLnBlbmRpbmdjYi0tO1xuICAgICAgY2IoZXJyKTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICB9XG4gICAgaWYgKHN0YXRlLmNvcmtlZFJlcXVlc3RzRnJlZSkge1xuICAgICAgc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlLm5leHQgPSBfdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlID0gX3RoaXM7XG4gICAgfVxuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbi8qPHJlcGxhY2VtZW50PiovXG52YXIgYnVmZmVyU2hpbSA9IHJlcXVpcmUoJ2J1ZmZlci1zaGltcycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyTGlzdDtcblxuZnVuY3Rpb24gQnVmZmVyTGlzdCgpIHtcbiAgdGhpcy5oZWFkID0gbnVsbDtcbiAgdGhpcy50YWlsID0gbnVsbDtcbiAgdGhpcy5sZW5ndGggPSAwO1xufVxuXG5CdWZmZXJMaXN0LnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKHYpIHtcbiAgdmFyIGVudHJ5ID0geyBkYXRhOiB2LCBuZXh0OiBudWxsIH07XG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHRoaXMudGFpbC5uZXh0ID0gZW50cnk7ZWxzZSB0aGlzLmhlYWQgPSBlbnRyeTtcbiAgdGhpcy50YWlsID0gZW50cnk7XG4gICsrdGhpcy5sZW5ndGg7XG59O1xuXG5CdWZmZXJMaXN0LnByb3RvdHlwZS51bnNoaWZ0ID0gZnVuY3Rpb24gKHYpIHtcbiAgdmFyIGVudHJ5ID0geyBkYXRhOiB2LCBuZXh0OiB0aGlzLmhlYWQgfTtcbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB0aGlzLnRhaWwgPSBlbnRyeTtcbiAgdGhpcy5oZWFkID0gZW50cnk7XG4gICsrdGhpcy5sZW5ndGg7XG59O1xuXG5CdWZmZXJMaXN0LnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gIHZhciByZXQgPSB0aGlzLmhlYWQuZGF0YTtcbiAgaWYgKHRoaXMubGVuZ3RoID09PSAxKSB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSBudWxsO2Vsc2UgdGhpcy5oZWFkID0gdGhpcy5oZWFkLm5leHQ7XG4gIC0tdGhpcy5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5CdWZmZXJMaXN0LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbnVsbDtcbiAgdGhpcy5sZW5ndGggPSAwO1xufTtcblxuQnVmZmVyTGlzdC5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uIChzKSB7XG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuICB2YXIgcCA9IHRoaXMuaGVhZDtcbiAgdmFyIHJldCA9ICcnICsgcC5kYXRhO1xuICB3aGlsZSAocCA9IHAubmV4dCkge1xuICAgIHJldCArPSBzICsgcC5kYXRhO1xuICB9cmV0dXJuIHJldDtcbn07XG5cbkJ1ZmZlckxpc3QucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIChuKSB7XG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGJ1ZmZlclNoaW0uYWxsb2MoMCk7XG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIHRoaXMuaGVhZC5kYXRhO1xuICB2YXIgcmV0ID0gYnVmZmVyU2hpbS5hbGxvY1Vuc2FmZShuID4+PiAwKTtcbiAgdmFyIHAgPSB0aGlzLmhlYWQ7XG4gIHZhciBpID0gMDtcbiAgd2hpbGUgKHApIHtcbiAgICBwLmRhdGEuY29weShyZXQsIGkpO1xuICAgIGkgKz0gcC5kYXRhLmxlbmd0aDtcbiAgICBwID0gcC5uZXh0O1xuICB9XG4gIHJldHVybiByZXQ7XG59OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpO1xudmFyIEJ1ZmZlciA9IGJ1ZmZlci5CdWZmZXI7XG52YXIgU2xvd0J1ZmZlciA9IGJ1ZmZlci5TbG93QnVmZmVyO1xudmFyIE1BWF9MRU4gPSBidWZmZXIua01heExlbmd0aCB8fCAyMTQ3NDgzNjQ3O1xuZXhwb3J0cy5hbGxvYyA9IGZ1bmN0aW9uIGFsbG9jKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgQnVmZmVyLmFsbG9jID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYyhzaXplLCBmaWxsLCBlbmNvZGluZyk7XG4gIH1cbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IG5vdCBiZSBudW1iZXInKTtcbiAgfVxuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc2l6ZSBtdXN0IGJlIGEgbnVtYmVyJyk7XG4gIH1cbiAgaWYgKHNpemUgPiBNQVhfTEVOKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NpemUgaXMgdG9vIGxhcmdlJyk7XG4gIH1cbiAgdmFyIGVuYyA9IGVuY29kaW5nO1xuICB2YXIgX2ZpbGwgPSBmaWxsO1xuICBpZiAoX2ZpbGwgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuYyA9IHVuZGVmaW5lZDtcbiAgICBfZmlsbCA9IDA7XG4gIH1cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc2l6ZSk7XG4gIGlmICh0eXBlb2YgX2ZpbGwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIGZpbGxCdWYgPSBuZXcgQnVmZmVyKF9maWxsLCBlbmMpO1xuICAgIHZhciBmbGVuID0gZmlsbEJ1Zi5sZW5ndGg7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB3aGlsZSAoKytpIDwgc2l6ZSkge1xuICAgICAgYnVmW2ldID0gZmlsbEJ1ZltpICUgZmxlbl07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGJ1Zi5maWxsKF9maWxsKTtcbiAgfVxuICByZXR1cm4gYnVmO1xufVxuZXhwb3J0cy5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIGFsbG9jVW5zYWZlKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBCdWZmZXIuYWxsb2NVbnNhZmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jVW5zYWZlKHNpemUpO1xuICB9XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaXplIG11c3QgYmUgYSBudW1iZXInKTtcbiAgfVxuICBpZiAoc2l6ZSA+IE1BWF9MRU4pIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc2l6ZSBpcyB0b28gbGFyZ2UnKTtcbiAgfVxuICByZXR1cm4gbmV3IEJ1ZmZlcihzaXplKTtcbn1cbmV4cG9ydHMuZnJvbSA9IGZ1bmN0aW9uIGZyb20odmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIEJ1ZmZlci5mcm9tID09PSAnZnVuY3Rpb24nICYmICghZ2xvYmFsLlVpbnQ4QXJyYXkgfHwgVWludDhBcnJheS5mcm9tICE9PSBCdWZmZXIuZnJvbSkpIHtcbiAgICByZXR1cm4gQnVmZmVyLmZyb20odmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCk7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKTtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KTtcbiAgfVxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgdmFyIG9mZnNldCA9IGVuY29kaW5nT3JPZmZzZXQ7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgIH1cbiAgICB2YXIgbGVuID0gbGVuZ3RoO1xuICAgIGlmICh0eXBlb2YgbGVuID09PSAndW5kZWZpbmVkJykge1xuICAgICAgbGVuID0gdmFsdWUuYnl0ZUxlbmd0aCAtIG9mZnNldDtcbiAgICB9XG4gICAgaWYgKG9mZnNldCA+PSB2YWx1ZS5ieXRlTGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnb2Zmc2V0XFwnIGlzIG91dCBvZiBib3VuZHMnKTtcbiAgICB9XG4gICAgaWYgKGxlbiA+IHZhbHVlLmJ5dGVMZW5ndGggLSBvZmZzZXQpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcXCdsZW5ndGhcXCcgaXMgb3V0IG9mIGJvdW5kcycpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEJ1ZmZlcih2YWx1ZS5zbGljZShvZmZzZXQsIG9mZnNldCArIGxlbikpO1xuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG4gICAgdmFyIG91dCA9IG5ldyBCdWZmZXIodmFsdWUubGVuZ3RoKTtcbiAgICB2YWx1ZS5jb3B5KG91dCwgMCwgMCwgdmFsdWUubGVuZ3RoKTtcbiAgICByZXR1cm4gb3V0O1xuICB9XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSB8fCAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZS5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgfHwgJ2xlbmd0aCcgaW4gdmFsdWUpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlLnR5cGUgPT09ICdCdWZmZXInICYmIEFycmF5LmlzQXJyYXkodmFsdWUuZGF0YSkpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKHZhbHVlLmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcsIEJ1ZmZlciwgJyArICdBcnJheUJ1ZmZlciwgQXJyYXksIG9yIGFycmF5LWxpa2Ugb2JqZWN0LicpO1xufVxuZXhwb3J0cy5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiBhbGxvY1Vuc2FmZVNsb3coc2l6ZSkge1xuICBpZiAodHlwZW9mIEJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyhzaXplKTtcbiAgfVxuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc2l6ZSBtdXN0IGJlIGEgbnVtYmVyJyk7XG4gIH1cbiAgaWYgKHNpemUgPj0gTUFYX0xFTikge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdzaXplIGlzIHRvbyBsYXJnZScpO1xuICB9XG4gIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzaXplKTtcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuXG5mdW5jdGlvbiBpc0FycmF5KGFyZykge1xuICBpZiAoQXJyYXkuaXNBcnJheSkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGFyZyk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSBCdWZmZXIuaXNCdWZmZXI7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKCFwcm9jZXNzLnZlcnNpb24gfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjAuJykgPT09IDAgfHxcbiAgICBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjEuJykgPT09IDAgJiYgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YxLjguJykgIT09IDApIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBuZXh0VGljaztcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcHJvY2Vzcy5uZXh0VGljaztcbn1cblxuZnVuY3Rpb24gbmV4dFRpY2soZm4sIGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiY2FsbGJhY2tcIiBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgfVxuICB2YXIgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgdmFyIGFyZ3MsIGk7XG4gIHN3aXRjaCAobGVuKSB7XG4gIGNhc2UgMDpcbiAgY2FzZSAxOlxuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZuKTtcbiAgY2FzZSAyOlxuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uIGFmdGVyVGlja09uZSgpIHtcbiAgICAgIGZuLmNhbGwobnVsbCwgYXJnMSk7XG4gICAgfSk7XG4gIGNhc2UgMzpcbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2tUd28oKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIGFyZzEsIGFyZzIpO1xuICAgIH0pO1xuICBjYXNlIDQ6XG4gICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gYWZ0ZXJUaWNrVGhyZWUoKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIGFyZzEsIGFyZzIsIGFyZzMpO1xuICAgIH0pO1xuICBkZWZhdWx0OlxuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgaSA9IDA7XG4gICAgd2hpbGUgKGkgPCBhcmdzLmxlbmd0aCkge1xuICAgICAgYXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2soKSB7XG4gICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9KTtcbiAgfVxufVxuIiwiXG4vKipcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZGVwcmVjYXRlO1xuXG4vKipcbiAqIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4gKiBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2Uubm9EZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudGhyb3dEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCB0aHJvdyBhbiBFcnJvciB3aGVuIGludm9rZWQuXG4gKlxuICogSWYgYGxvY2FsU3RvcmFnZS50cmFjZURlcHJlY2F0aW9uID0gdHJ1ZWAgaXMgc2V0LCB0aGVuIGRlcHJlY2F0ZWQgZnVuY3Rpb25zXG4gKiB3aWxsIGludm9rZSBgY29uc29sZS50cmFjZSgpYCBpbnN0ZWFkIG9mIGBjb25zb2xlLmVycm9yKClgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gdGhlIGZ1bmN0aW9uIHRvIGRlcHJlY2F0ZVxuICogQHBhcmFtIHtTdHJpbmd9IG1zZyAtIHRoZSBzdHJpbmcgdG8gcHJpbnQgdG8gdGhlIGNvbnNvbGUgd2hlbiBgZm5gIGlzIGludm9rZWRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gYSBuZXcgXCJkZXByZWNhdGVkXCIgdmVyc2lvbiBvZiBgZm5gXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlcHJlY2F0ZSAoZm4sIG1zZykge1xuICBpZiAoY29uZmlnKCdub0RlcHJlY2F0aW9uJykpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChjb25maWcoJ3Rocm93RGVwcmVjYXRpb24nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoY29uZmlnKCd0cmFjZURlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBgbG9jYWxTdG9yYWdlYCBmb3IgYm9vbGVhbiB2YWx1ZXMgZm9yIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29uZmlnIChuYW1lKSB7XG4gIC8vIGFjY2Vzc2luZyBnbG9iYWwubG9jYWxTdG9yYWdlIGNhbiB0cmlnZ2VyIGEgRE9NRXhjZXB0aW9uIGluIHNhbmRib3hlZCBpZnJhbWVzXG4gIHRyeSB7XG4gICAgaWYgKCFnbG9iYWwubG9jYWxTdG9yYWdlKSByZXR1cm4gZmFsc2U7XG4gIH0gY2F0Y2ggKF8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHZhbCA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbbmFtZV07XG4gIGlmIChudWxsID09IHZhbCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gU3RyaW5nKHZhbCkudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qc1wiKVxuIiwidmFyIFN0cmVhbSA9IChmdW5jdGlvbiAoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVxdWlyZSgnc3QnICsgJ3JlYW0nKTsgLy8gaGFjayB0byBmaXggYSBjaXJjdWxhciBkZXBlbmRlbmN5IGlzc3VlIHdoZW4gdXNlZCB3aXRoIGJyb3dzZXJpZnlcbiAgfSBjYXRjaChfKXt9XG59KCkpO1xuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcycpO1xuZXhwb3J0cy5TdHJlYW0gPSBTdHJlYW0gfHwgZXhwb3J0cztcbmV4cG9ydHMuUmVhZGFibGUgPSBleHBvcnRzO1xuZXhwb3J0cy5Xcml0YWJsZSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fd3JpdGFibGUuanMnKTtcbmV4cG9ydHMuRHVwbGV4ID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9kdXBsZXguanMnKTtcbmV4cG9ydHMuVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV90cmFuc2Zvcm0uanMnKTtcbmV4cG9ydHMuUGFzc1Rocm91Z2ggPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzJyk7XG5cbmlmICghcHJvY2Vzcy5icm93c2VyICYmIHByb2Nlc3MuZW52LlJFQURBQkxFX1NUUkVBTSA9PT0gJ2Rpc2FibGUnICYmIFN0cmVhbSkge1xuICBtb2R1bGUuZXhwb3J0cyA9IFN0cmVhbTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzXCIpXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzXCIpXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBTdHJlYW07XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmluaGVyaXRzKFN0cmVhbSwgRUUpO1xuU3RyZWFtLlJlYWRhYmxlID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzJyk7XG5TdHJlYW0uV3JpdGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vd3JpdGFibGUuanMnKTtcblN0cmVhbS5EdXBsZXggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzJyk7XG5TdHJlYW0uVHJhbnNmb3JtID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3RyYW5zZm9ybS5qcycpO1xuU3RyZWFtLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3Bhc3N0aHJvdWdoLmpzJyk7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuNC54XG5TdHJlYW0uU3RyZWFtID0gU3RyZWFtO1xuXG5cblxuLy8gb2xkLXN0eWxlIHN0cmVhbXMuICBOb3RlIHRoYXQgdGhlIHBpcGUgbWV0aG9kICh0aGUgb25seSByZWxldmFudFxuLy8gcGFydCBvZiB0aGlzIGNsYXNzKSBpcyBvdmVycmlkZGVuIGluIHRoZSBSZWFkYWJsZSBjbGFzcy5cblxuZnVuY3Rpb24gU3RyZWFtKCkge1xuICBFRS5jYWxsKHRoaXMpO1xufVxuXG5TdHJlYW0ucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihkZXN0LCBvcHRpb25zKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGlmIChkZXN0LndyaXRhYmxlKSB7XG4gICAgICBpZiAoZmFsc2UgPT09IGRlc3Qud3JpdGUoY2h1bmspICYmIHNvdXJjZS5wYXVzZSkge1xuICAgICAgICBzb3VyY2UucGF1c2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2RhdGEnLCBvbmRhdGEpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhaW4oKSB7XG4gICAgaWYgKHNvdXJjZS5yZWFkYWJsZSAmJiBzb3VyY2UucmVzdW1lKSB7XG4gICAgICBzb3VyY2UucmVzdW1lKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICAvLyBJZiB0aGUgJ2VuZCcgb3B0aW9uIGlzIG5vdCBzdXBwbGllZCwgZGVzdC5lbmQoKSB3aWxsIGJlIGNhbGxlZCB3aGVuXG4gIC8vIHNvdXJjZSBnZXRzIHRoZSAnZW5kJyBvciAnY2xvc2UnIGV2ZW50cy4gIE9ubHkgZGVzdC5lbmQoKSBvbmNlLlxuICBpZiAoIWRlc3QuX2lzU3RkaW8gJiYgKCFvcHRpb25zIHx8IG9wdGlvbnMuZW5kICE9PSBmYWxzZSkpIHtcbiAgICBzb3VyY2Uub24oJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2Uub24oJ2Nsb3NlJywgb25jbG9zZSk7XG4gIH1cblxuICB2YXIgZGlkT25FbmQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGRlc3QuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykgZGVzdC5kZXN0cm95KCk7XG4gIH1cblxuICAvLyBkb24ndCBsZWF2ZSBkYW5nbGluZyBwaXBlcyB3aGVuIHRoZXJlIGFyZSBlcnJvcnMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKEVFLmxpc3RlbmVyQ291bnQodGhpcywgJ2Vycm9yJykgPT09IDApIHtcbiAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgc3RyZWFtIGVycm9yIGluIHBpcGUuXG4gICAgfVxuICB9XG5cbiAgc291cmNlLm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuXG4gIC8vIHJlbW92ZSBhbGwgdGhlIGV2ZW50IGxpc3RlbmVycyB0aGF0IHdlcmUgYWRkZWQuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgY2xlYW51cCk7XG4gIH1cblxuICBzb3VyY2Uub24oJ2VuZCcsIGNsZWFudXApO1xuICBzb3VyY2Uub24oJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgZGVzdC5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0LmVtaXQoJ3BpcGUnLCBzb3VyY2UpO1xuXG4gIC8vIEFsbG93IGZvciB1bml4LWxpa2UgdXNhZ2U6IEEucGlwZShCKS5waXBlKEMpXG4gIHJldHVybiBkZXN0O1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuXG52YXIgaXNCdWZmZXJFbmNvZGluZyA9IEJ1ZmZlci5pc0VuY29kaW5nXG4gIHx8IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gICAgICAgc3dpdGNoIChlbmNvZGluZyAmJiBlbmNvZGluZy50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICBjYXNlICdoZXgnOiBjYXNlICd1dGY4JzogY2FzZSAndXRmLTgnOiBjYXNlICdhc2NpaSc6IGNhc2UgJ2JpbmFyeSc6IGNhc2UgJ2Jhc2U2NCc6IGNhc2UgJ3VjczInOiBjYXNlICd1Y3MtMic6IGNhc2UgJ3V0ZjE2bGUnOiBjYXNlICd1dGYtMTZsZSc6IGNhc2UgJ3Jhdyc6IHJldHVybiB0cnVlO1xuICAgICAgICAgZGVmYXVsdDogcmV0dXJuIGZhbHNlO1xuICAgICAgIH1cbiAgICAgfVxuXG5cbmZ1bmN0aW9uIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIGlmIChlbmNvZGluZyAmJiAhaXNCdWZmZXJFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XG4gIH1cbn1cblxuLy8gU3RyaW5nRGVjb2RlciBwcm92aWRlcyBhbiBpbnRlcmZhY2UgZm9yIGVmZmljaWVudGx5IHNwbGl0dGluZyBhIHNlcmllcyBvZlxuLy8gYnVmZmVycyBpbnRvIGEgc2VyaWVzIG9mIEpTIHN0cmluZ3Mgd2l0aG91dCBicmVha2luZyBhcGFydCBtdWx0aS1ieXRlXG4vLyBjaGFyYWN0ZXJzLiBDRVNVLTggaXMgaGFuZGxlZCBhcyBwYXJ0IG9mIHRoZSBVVEYtOCBlbmNvZGluZy5cbi8vXG4vLyBAVE9ETyBIYW5kbGluZyBhbGwgZW5jb2RpbmdzIGluc2lkZSBhIHNpbmdsZSBvYmplY3QgbWFrZXMgaXQgdmVyeSBkaWZmaWN1bHRcbi8vIHRvIHJlYXNvbiBhYm91dCB0aGlzIGNvZGUsIHNvIGl0IHNob3VsZCBiZSBzcGxpdCB1cCBpbiB0aGUgZnV0dXJlLlxuLy8gQFRPRE8gVGhlcmUgc2hvdWxkIGJlIGEgdXRmOC1zdHJpY3QgZW5jb2RpbmcgdGhhdCByZWplY3RzIGludmFsaWQgVVRGLTggY29kZVxuLy8gcG9pbnRzIGFzIHVzZWQgYnkgQ0VTVS04LlxudmFyIFN0cmluZ0RlY29kZXIgPSBleHBvcnRzLlN0cmluZ0RlY29kZXIgPSBmdW5jdGlvbihlbmNvZGluZykge1xuICB0aGlzLmVuY29kaW5nID0gKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bLV9dLywgJycpO1xuICBhc3NlcnRFbmNvZGluZyhlbmNvZGluZyk7XG4gIHN3aXRjaCAodGhpcy5lbmNvZGluZykge1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgLy8gQ0VTVS04IHJlcHJlc2VudHMgZWFjaCBvZiBTdXJyb2dhdGUgUGFpciBieSAzLWJ5dGVzXG4gICAgICB0aGlzLnN1cnJvZ2F0ZVNpemUgPSAzO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICAvLyBVVEYtMTYgcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDItYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDI7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAvLyBCYXNlLTY0IHN0b3JlcyAzIGJ5dGVzIGluIDQgY2hhcnMsIGFuZCBwYWRzIHRoZSByZW1haW5kZXIuXG4gICAgICB0aGlzLnN1cnJvZ2F0ZVNpemUgPSAzO1xuICAgICAgdGhpcy5kZXRlY3RJbmNvbXBsZXRlQ2hhciA9IGJhc2U2NERldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRoaXMud3JpdGUgPSBwYXNzVGhyb3VnaFdyaXRlO1xuICAgICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRW5vdWdoIHNwYWNlIHRvIHN0b3JlIGFsbCBieXRlcyBvZiBhIHNpbmdsZSBjaGFyYWN0ZXIuIFVURi04IG5lZWRzIDRcbiAgLy8gYnl0ZXMsIGJ1dCBDRVNVLTggbWF5IHJlcXVpcmUgdXAgdG8gNiAoMyBieXRlcyBwZXIgc3Vycm9nYXRlKS5cbiAgdGhpcy5jaGFyQnVmZmVyID0gbmV3IEJ1ZmZlcig2KTtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIHJlY2VpdmVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJSZWNlaXZlZCA9IDA7XG4gIC8vIE51bWJlciBvZiBieXRlcyBleHBlY3RlZCBmb3IgdGhlIGN1cnJlbnQgaW5jb21wbGV0ZSBtdWx0aS1ieXRlIGNoYXJhY3Rlci5cbiAgdGhpcy5jaGFyTGVuZ3RoID0gMDtcbn07XG5cblxuLy8gd3JpdGUgZGVjb2RlcyB0aGUgZ2l2ZW4gYnVmZmVyIGFuZCByZXR1cm5zIGl0IGFzIEpTIHN0cmluZyB0aGF0IGlzXG4vLyBndWFyYW50ZWVkIHRvIG5vdCBjb250YWluIGFueSBwYXJ0aWFsIG11bHRpLWJ5dGUgY2hhcmFjdGVycy4gQW55IHBhcnRpYWxcbi8vIGNoYXJhY3RlciBmb3VuZCBhdCB0aGUgZW5kIG9mIHRoZSBidWZmZXIgaXMgYnVmZmVyZWQgdXAsIGFuZCB3aWxsIGJlXG4vLyByZXR1cm5lZCB3aGVuIGNhbGxpbmcgd3JpdGUgYWdhaW4gd2l0aCB0aGUgcmVtYWluaW5nIGJ5dGVzLlxuLy9cbi8vIE5vdGU6IENvbnZlcnRpbmcgYSBCdWZmZXIgY29udGFpbmluZyBhbiBvcnBoYW4gc3Vycm9nYXRlIHRvIGEgU3RyaW5nXG4vLyBjdXJyZW50bHkgd29ya3MsIGJ1dCBjb252ZXJ0aW5nIGEgU3RyaW5nIHRvIGEgQnVmZmVyICh2aWEgYG5ldyBCdWZmZXJgLCBvclxuLy8gQnVmZmVyI3dyaXRlKSB3aWxsIHJlcGxhY2UgaW5jb21wbGV0ZSBzdXJyb2dhdGVzIHdpdGggdGhlIHVuaWNvZGVcbi8vIHJlcGxhY2VtZW50IGNoYXJhY3Rlci4gU2VlIGh0dHBzOi8vY29kZXJldmlldy5jaHJvbWl1bS5vcmcvMTIxMTczMDA5LyAuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICB2YXIgY2hhclN0ciA9ICcnO1xuICAvLyBpZiBvdXIgbGFzdCB3cml0ZSBlbmRlZCB3aXRoIGFuIGluY29tcGxldGUgbXVsdGlieXRlIGNoYXJhY3RlclxuICB3aGlsZSAodGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgLy8gZGV0ZXJtaW5lIGhvdyBtYW55IHJlbWFpbmluZyBieXRlcyB0aGlzIGJ1ZmZlciBoYXMgdG8gb2ZmZXIgZm9yIHRoaXMgY2hhclxuICAgIHZhciBhdmFpbGFibGUgPSAoYnVmZmVyLmxlbmd0aCA+PSB0aGlzLmNoYXJMZW5ndGggLSB0aGlzLmNoYXJSZWNlaXZlZCkgP1xuICAgICAgICB0aGlzLmNoYXJMZW5ndGggLSB0aGlzLmNoYXJSZWNlaXZlZCA6XG4gICAgICAgIGJ1ZmZlci5sZW5ndGg7XG5cbiAgICAvLyBhZGQgdGhlIG5ldyBieXRlcyB0byB0aGUgY2hhciBidWZmZXJcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIHRoaXMuY2hhclJlY2VpdmVkLCAwLCBhdmFpbGFibGUpO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IGF2YWlsYWJsZTtcblxuICAgIGlmICh0aGlzLmNoYXJSZWNlaXZlZCA8IHRoaXMuY2hhckxlbmd0aCkge1xuICAgICAgLy8gc3RpbGwgbm90IGVub3VnaCBjaGFycyBpbiB0aGlzIGJ1ZmZlcj8gd2FpdCBmb3IgbW9yZSAuLi5cbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYnl0ZXMgYmVsb25naW5nIHRvIHRoZSBjdXJyZW50IGNoYXJhY3RlciBmcm9tIHRoZSBidWZmZXJcbiAgICBidWZmZXIgPSBidWZmZXIuc2xpY2UoYXZhaWxhYmxlLCBidWZmZXIubGVuZ3RoKTtcblxuICAgIC8vIGdldCB0aGUgY2hhcmFjdGVyIHRoYXQgd2FzIHNwbGl0XG4gICAgY2hhclN0ciA9IHRoaXMuY2hhckJ1ZmZlci5zbGljZSgwLCB0aGlzLmNoYXJMZW5ndGgpLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpO1xuXG4gICAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICAgIHZhciBjaGFyQ29kZSA9IGNoYXJTdHIuY2hhckNvZGVBdChjaGFyU3RyLmxlbmd0aCAtIDEpO1xuICAgIGlmIChjaGFyQ29kZSA+PSAweEQ4MDAgJiYgY2hhckNvZGUgPD0gMHhEQkZGKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggKz0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgICAgY2hhclN0ciA9ICcnO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHRoaXMuY2hhclJlY2VpdmVkID0gdGhpcy5jaGFyTGVuZ3RoID0gMDtcblxuICAgIC8vIGlmIHRoZXJlIGFyZSBubyBtb3JlIGJ5dGVzIGluIHRoaXMgYnVmZmVyLCBqdXN0IGVtaXQgb3VyIGNoYXJcbiAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGNoYXJTdHI7XG4gICAgfVxuICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGFuZCBzZXQgY2hhckxlbmd0aCAvIGNoYXJSZWNlaXZlZFxuICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyKGJ1ZmZlcik7XG5cbiAgdmFyIGVuZCA9IGJ1ZmZlci5sZW5ndGg7XG4gIGlmICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBidWZmZXIgdGhlIGluY29tcGxldGUgY2hhcmFjdGVyIGJ5dGVzIHdlIGdvdFxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgMCwgYnVmZmVyLmxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkLCBlbmQpO1xuICAgIGVuZCAtPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgfVxuXG4gIGNoYXJTdHIgKz0gYnVmZmVyLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcsIDAsIGVuZCk7XG5cbiAgdmFyIGVuZCA9IGNoYXJTdHIubGVuZ3RoIC0gMTtcbiAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGVuZCk7XG4gIC8vIENFU1UtODogbGVhZCBzdXJyb2dhdGUgKEQ4MDAtREJGRikgaXMgYWxzbyB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXJcbiAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuc3Vycm9nYXRlU2l6ZTtcbiAgICB0aGlzLmNoYXJMZW5ndGggKz0gc2l6ZTtcbiAgICB0aGlzLmNoYXJSZWNlaXZlZCArPSBzaXplO1xuICAgIHRoaXMuY2hhckJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgc2l6ZSwgMCwgc2l6ZSk7XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCAwLCBzaXplKTtcbiAgICByZXR1cm4gY2hhclN0ci5zdWJzdHJpbmcoMCwgZW5kKTtcbiAgfVxuXG4gIC8vIG9yIGp1c3QgZW1pdCB0aGUgY2hhclN0clxuICByZXR1cm4gY2hhclN0cjtcbn07XG5cbi8vIGRldGVjdEluY29tcGxldGVDaGFyIGRldGVybWluZXMgaWYgdGhlcmUgaXMgYW4gaW5jb21wbGV0ZSBVVEYtOCBjaGFyYWN0ZXIgYXRcbi8vIHRoZSBlbmQgb2YgdGhlIGdpdmVuIGJ1ZmZlci4gSWYgc28sIGl0IHNldHMgdGhpcy5jaGFyTGVuZ3RoIHRvIHRoZSBieXRlXG4vLyBsZW5ndGggdGhhdCBjaGFyYWN0ZXIsIGFuZCBzZXRzIHRoaXMuY2hhclJlY2VpdmVkIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXNcbi8vIHRoYXQgYXJlIGF2YWlsYWJsZSBmb3IgdGhpcyBjaGFyYWN0ZXIuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5kZXRlY3RJbmNvbXBsZXRlQ2hhciA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgYnl0ZXMgd2UgaGF2ZSB0byBjaGVjayBhdCB0aGUgZW5kIG9mIHRoaXMgYnVmZmVyXG4gIHZhciBpID0gKGJ1ZmZlci5sZW5ndGggPj0gMykgPyAzIDogYnVmZmVyLmxlbmd0aDtcblxuICAvLyBGaWd1cmUgb3V0IGlmIG9uZSBvZiB0aGUgbGFzdCBpIGJ5dGVzIG9mIG91ciBidWZmZXIgYW5ub3VuY2VzIGFuXG4gIC8vIGluY29tcGxldGUgY2hhci5cbiAgZm9yICg7IGkgPiAwOyBpLS0pIHtcbiAgICB2YXIgYyA9IGJ1ZmZlcltidWZmZXIubGVuZ3RoIC0gaV07XG5cbiAgICAvLyBTZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9VVEYtOCNEZXNjcmlwdGlvblxuXG4gICAgLy8gMTEwWFhYWFhcbiAgICBpZiAoaSA9PSAxICYmIGMgPj4gNSA9PSAweDA2KSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSAyO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gMTExMFhYWFhcbiAgICBpZiAoaSA8PSAyICYmIGMgPj4gNCA9PSAweDBFKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSAzO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gMTExMTBYWFhcbiAgICBpZiAoaSA8PSAzICYmIGMgPj4gMyA9PSAweDFFKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSA0O1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gaTtcbn07XG5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICB2YXIgcmVzID0gJyc7XG4gIGlmIChidWZmZXIgJiYgYnVmZmVyLmxlbmd0aClcbiAgICByZXMgPSB0aGlzLndyaXRlKGJ1ZmZlcik7XG5cbiAgaWYgKHRoaXMuY2hhclJlY2VpdmVkKSB7XG4gICAgdmFyIGNyID0gdGhpcy5jaGFyUmVjZWl2ZWQ7XG4gICAgdmFyIGJ1ZiA9IHRoaXMuY2hhckJ1ZmZlcjtcbiAgICB2YXIgZW5jID0gdGhpcy5lbmNvZGluZztcbiAgICByZXMgKz0gYnVmLnNsaWNlKDAsIGNyKS50b1N0cmluZyhlbmMpO1xuICB9XG5cbiAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIHBhc3NUaHJvdWdoV3JpdGUoYnVmZmVyKSB7XG4gIHJldHVybiBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG59XG5cbmZ1bmN0aW9uIHV0ZjE2RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDI7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMiA6IDA7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NERldGVjdEluY29tcGxldGVDaGFyKGJ1ZmZlcikge1xuICB0aGlzLmNoYXJSZWNlaXZlZCA9IGJ1ZmZlci5sZW5ndGggJSAzO1xuICB0aGlzLmNoYXJMZW5ndGggPSB0aGlzLmNoYXJSZWNlaXZlZCA/IDMgOiAwO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiIsImNsYXNzIEFqYXhMb2FkZXIge1xyXG5cdGxvYWQoZmlsZW5hbWUpIHtcclxuXHRcdHJldHVybiAkLmdldChmaWxlbmFtZSkudGhlbihcclxuXHRcdFx0ZnVuY3Rpb24oY3N2KSB7XHJcblx0XHRcdFx0cmV0dXJuIGNzdjtcclxuXHRcdFx0fSxcclxuXHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBFcnJvcihcItCd0LUg0YPQtNCw0LvQvtGB0Ywg0LfQsNCz0YDRg9C30LjRgtGMIFwiICsgZmlsZW5hbWUpO1xyXG5cdFx0XHR9KTtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQWpheExvYWRlcjtcclxuIiwiY2xhc3MgRmlsZUxvYWRlciB7XHJcblx0bG9hZChmaWxlKSB7XHJcblx0XHR2YXIgZCA9ICQuRGVmZXJyZWQoKTtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciByZWFkZXIgPSBuZXcgd2luZG93LkZpbGVSZWFkZXIoKTtcclxuXHRcdFx0cmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRkLnJlc29sdmUoZS50YXJnZXQucmVzdWx0KTtcclxuXHRcdFx0fTtcclxuXHRcdFx0cmVhZGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcclxuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IFwi0J3QtSDRg9C00LDQu9C+0YHRjCDQt9Cw0LPRgNGD0LfQuNGC0Ywg0YTQsNC50LtcIjtcclxuXHRcdFx0XHRpZiAoZXJyICE9PSB1bmRlZmluZWQpXHJcblx0XHRcdFx0XHRtZXNzYWdlICs9IFwiOiBcIiArIGVycjtcclxuXHRcdFx0XHRkLnJlamVjdChuZXcgRXJyb3IobWVzc2FnZSkpO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHRyZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcclxuXHRcdH1cclxuXHRcdGNhdGNoIChleCkge1xyXG5cdFx0XHRkLnJlamVjdChleCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZDtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRmlsZUxvYWRlcjtcclxuIiwiY2xhc3MgTG9hZENvbnRyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKG1vZGVsKSB7XHJcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xyXG5cclxuXHRcdHRoaXMucGFydGljaXBhbnRzUmVnaXN0cnlVcmwgPSBcImRhdGEv0JXQk9Cg0J8uY3N2XCI7XHJcblx0XHR0aGlzLm93bmVyc1JlZ2lzdHJ5VXJsID0gXCJkYXRhL9Ch0L7QsdGB0YLQstC10L3QvdC40LrQuC5jc3ZcIjtcclxuXHRcdHRoaXMuaW5jb3JyZWN0QXBhcnRtZW50c1VybCA9IFwiZGF0YS/QndC10LrQvtGA0YDQtdC60YLQvdGL0LUg0LfQsNC/0LjRgdC4LdC00YPQsdC70LjQutCw0YLRiy5jc3ZcIjtcclxuXHRcdHRoaXMuYXBhcnRtZW50c1dpdGhvdXRTZWN0aW9uVXJsID0gXCJkYXRhL9Ca0LLQsNGA0YLQuNGA0Ysg0LHQtdC3INC90L7QvNC10YDQsCDRgdC10LrRhtC40LguY3N2XCI7XHJcblx0XHR0aGlzLm9sZEFwYXJ0bWVudE51bWJlcnNVcmwgPSBcImRhdGEv0KHRgtCw0YDRi9C1INC90L7QvNC10YDQsCDQutCy0LDRgNGC0LjRgC5jc3ZcIjtcclxuXHRcdHRoaXMuanVyaWRpY2FsUGVyc29uc1VybCA9IFwiZGF0YS/QrtGA0LjQtNC40YfQtdGB0LrQuNC1INC70LjRhtCwLmNzdlwiO1xyXG5cclxuXHRcdHRoaXMuX3BhcnRpY2lwYW50c1JlZ2lzdHJ5ID0gbnVsbDtcclxuXHRcdHRoaXMuX293bmVyc1JlZ2lzdHJ5ID0gbnVsbDtcclxuXHRcdHRoaXMuX2FwYXJ0bWVudHNXaXRob3V0U2VjdGlvbiA9IG51bGw7XHJcblx0XHR0aGlzLl9pbmNvcnJlY3RBcGFydG1lbnRzID0gbnVsbDtcclxuXHRcdHRoaXMuX29sZEFwYXJ0bWVudE51bWJlcnMgPSBudWxsO1xyXG5cdFx0dGhpcy5fanVyaWRpY2FsUGVyc29ucyA9IG51bGw7XHJcblxyXG5cdFx0dGhpcy5fYWpheExvYWRlciA9IG5ldyBBamF4TG9hZGVyKCk7XHJcblx0XHR0aGlzLl9maWxlTG9hZGVyID0gbmV3IEZpbGVMb2FkZXIoKTtcclxuXHJcblx0XHR0aGlzLl9vcENvdW50ZXIgPSAwO1xyXG5cdFx0dGhpcy5vbk9wZXJhdGlvblN0YXJ0ID0gbmV3IHV0aWxzLkRlbGVnYXRlKCk7XHJcblx0XHR0aGlzLm9uT3BlcmF0aW9uRW5kID0gbmV3IHV0aWxzLkRlbGVnYXRlKCk7XHJcblx0fVxyXG5cclxuXHQvLyBsb2FkIGRlZmF1bHQgZGF0YVxyXG5cdGluaXQoKSAvKiAtPiBEZWZlcnJlZCAqLyB7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cdFx0cmV0dXJuIG1lLl9vcGVyYXRpb24oKCkgPT4gJC5EZWZlcnJlZCgpLnJlc29sdmUoKVxyXG5cdFx0XHQudGhlbigoKSA9PiBtZS5sb2FkRGVmYXVsdFBhcnRpY2lwYW50c1JlZ2lzdHJ5KCkpXHJcblx0XHRcdC50aGVuKCgpID0+IG1lLmxvYWREZWZhdWx0T3duZXJzUmVnaXN0cnkoKSlcclxuXHRcdFx0LnRoZW4oKCkgPT4gbWUubG9hZERlZmF1bHRBcGFydG1lbnRzV2l0aG91dFNlY3Rpb24oKSlcclxuXHRcdFx0LnRoZW4oKCkgPT4gbWUubG9hZERlZmF1bHRJbmNvcnJlY3RBcGFydG1lbnRzKCkpXHJcblx0XHRcdC50aGVuKCgpID0+IG1lLmxvYWREZWZhdWx0T2xkQXBhcnRtZW50TnVtYmVycygpKVxyXG5cdFx0XHQudGhlbigoKSA9PiBtZS5sb2FkRGVmYXVsdEp1cmlkaWNhbFBlcnNvbnMoKSlcclxuXHRcdFx0LnRoZW4oKCkgPT4gbWUudXBkYXRlTW9kZWwoKSkpO1xyXG5cdH1cclxuXHJcblx0bG9hZERlZmF1bHRQYXJ0aWNpcGFudHNSZWdpc3RyeSgpIC8qIC0+IERlZmVycmVkICovIHtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRyZXR1cm4gbWUuX29wZXJhdGlvbigoKSA9PiBtZS5fYWpheExvYWRlci5sb2FkKHRoaXMucGFydGljaXBhbnRzUmVnaXN0cnlVcmwpXHJcblx0XHRcdC50aGVuKGZ1bmN0aW9uKGNzdikgeyBtZS5fcGFydGljaXBhbnRzUmVnaXN0cnkgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZERlZmF1bHRPd25lcnNSZWdpc3RyeSgpIC8qIC0+IERlZmVycmVkICovIHtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRyZXR1cm4gbWUuX29wZXJhdGlvbigoKSA9PiBtZS5fYWpheExvYWRlci5sb2FkKHRoaXMub3duZXJzUmVnaXN0cnlVcmwpXHJcblx0XHRcdC50aGVuKGZ1bmN0aW9uKGNzdikgeyBtZS5fb3duZXJzUmVnaXN0cnkgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZERlZmF1bHRBcGFydG1lbnRzV2l0aG91dFNlY3Rpb24oKSAvKiAtPiBEZWZlcnJlZCAqLyB7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cdFx0cmV0dXJuIG1lLl9vcGVyYXRpb24oKCkgPT4gbWUuX2FqYXhMb2FkZXIubG9hZCh0aGlzLmFwYXJ0bWVudHNXaXRob3V0U2VjdGlvblVybClcclxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oY3N2KSB7IG1lLl9hcGFydG1lbnRzV2l0aG91dFNlY3Rpb24gPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZERlZmF1bHRJbmNvcnJlY3RBcGFydG1lbnRzKCkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+IG1lLl9hamF4TG9hZGVyLmxvYWQodGhpcy5pbmNvcnJlY3RBcGFydG1lbnRzVXJsKVxyXG5cdFx0XHQudGhlbihmdW5jdGlvbihjc3YpIHsgbWUuX2luY29ycmVjdEFwYXJ0bWVudHMgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZERlZmF1bHRPbGRBcGFydG1lbnROdW1iZXJzKCkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+IG1lLl9hamF4TG9hZGVyLmxvYWQodGhpcy5vbGRBcGFydG1lbnROdW1iZXJzVXJsKVxyXG5cdFx0XHQudGhlbihmdW5jdGlvbihjc3YpIHsgbWUuX29sZEFwYXJ0bWVudE51bWJlcnMgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZERlZmF1bHRKdXJpZGljYWxQZXJzb25zKCkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+IG1lLl9hamF4TG9hZGVyLmxvYWQodGhpcy5qdXJpZGljYWxQZXJzb25zVXJsKVxyXG5cdFx0XHQudGhlbihmdW5jdGlvbihjc3YpIHsgbWUuX2p1cmlkaWNhbFBlcnNvbnMgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblxyXG5cdGxvYWRBcGFydG1lbnRzV2l0aG91dFNlY3Rpb24oZmlsZSkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+IG1lLl9maWxlTG9hZGVyLmxvYWQoZmlsZSlcclxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oY3N2KSB7IG1lLl9hcGFydG1lbnRzV2l0aG91dFNlY3Rpb24gPSBjc3Y7IH0pKTtcclxuXHR9XHJcblx0bG9hZEluY29ycmVjdEFwYXJ0bWVudHMoZmlsZSkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+IG1lLl9maWxlTG9hZGVyLmxvYWQoZmlsZSlcclxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oY3N2KSB7IG1lLl9pbmNvcnJlY3RBcGFydG1lbnRzID0gY3N2OyB9KSk7XHJcblx0fVxyXG5cdGxvYWRPbGRBcGFydG1lbnROdW1iZXJzKGZpbGUpIC8qIC0+IERlZmVycmVkICovIHtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRyZXR1cm4gbWUuX29wZXJhdGlvbigoKSA9PiBtZS5fZmlsZUxvYWRlci5sb2FkKGZpbGUpXHJcblx0XHRcdC50aGVuKGZ1bmN0aW9uKGNzdikgeyBtZS5fb2xkQXBhcnRtZW50TnVtYmVycyA9IGNzdjsgfSkpO1xyXG5cdH1cclxuXHRsb2FkSnVyaWRpY2FsUGVyc29ucyhmaWxlKSAvKiAtPiBEZWZlcnJlZCAqLyB7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cdFx0cmV0dXJuIG1lLl9vcGVyYXRpb24oKCkgPT4gbWUuX2ZpbGVMb2FkZXIubG9hZChmaWxlKVxyXG5cdFx0XHQudGhlbihmdW5jdGlvbihjc3YpIHsgbWUuX2p1cmlkaWNhbFBlcnNvbnMgPSBjc3Y7IH0pKTtcclxuXHR9XHJcblxyXG5cdHVwZGF0ZU1vZGVsKCkgLyogLT4gRGVmZXJyZWQgKi8ge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHZhciBtb2RlbCA9IG5ldyBNb2RlbCgpO1xyXG5cclxuXHRcdHJldHVybiBtZS5fb3BlcmF0aW9uKCgpID0+ICQuRGVmZXJyZWQoKS5yZXNvbHZlKClcclxuXHRcdFx0LnRoZW4oKCkgPT4gcmVhZChcItC00LDQvdC90YvQtSDQuNC3INCV0JPQoNCfXCIsIG1lLl9wYXJ0aWNpcGFudHNSZWdpc3RyeSwgbmV3IFBhcnRpY2lwYW50c1JlZ2lzdHJ5UmVhZGVyKG1vZGVsKSkpXHJcblx0XHRcdC50aGVuKCgpID0+IHJlYWQoXCLQtNCw0L3QvdGL0LUg0LjQtyDRgNC10LXRgdGC0YDQsCDRgdC+0LHRgdGC0LLQtdC90L3QuNC60LDQvCDQtNC+0LvQtdC5XCIsIG1lLl9vd25lcnNSZWdpc3RyeSwgbmV3IE93bmVyc1JlZ2lzdHJ5UmVhZGVyKG1vZGVsKSkpXHJcblx0XHRcdC50aGVuKCgpID0+IHJlYWQoXCLQtNCw0L3QvdGL0LUg0L/QviDQutCy0LDRgNGC0LjRgNCw0Lwg0LHQtdC3INC90L7QvNC10YDQsCDRgdC10LrRhtC40LhcIiwgbWUuX2FwYXJ0bWVudHNXaXRob3V0U2VjdGlvbiwgbmV3IEFwYXJ0bWVudHNXaXRob3V0U2VjdGlvblJlYWRlcihtb2RlbCkpKVxyXG5cdFx0XHQudGhlbigoKSA9PiByZWFkKFwi0LTQsNC90L3Ri9C1INC/0L4g0L3QtdC60L7RgNGA0LXQutGC0L3Ri9C8INC30LDQv9C40YHRj9C8LdC00YPQsdC70LjQutCw0YLQsNC8XCIsIG1lLl9pbmNvcnJlY3RBcGFydG1lbnRzLCBuZXcgSW5jb3JyZWN0QXBhcnRtZW50c1JlYWRlcihtb2RlbCkpKVxyXG5cdFx0XHQudGhlbigoKSA9PiByZWFkKFwi0LTQsNC90L3Ri9C1INC/0L4g0YHRgtCw0YDRi9C8INC90L7QvNC10YDQsNC8INC60LLQsNGA0YLQuNGAXCIsIG1lLl9vbGRBcGFydG1lbnROdW1iZXJzLCBuZXcgT2xkQXBhcnRtZW50TnVtYmVyc1JlYWRlcihtb2RlbCkpKVxyXG5cdFx0XHQudGhlbigoKSA9PiByZWFkKFwi0LTQsNC90L3Ri9C1INC/0L4g0Y7RgNC40LTQuNGH0LXRgdC60LjQvCDQu9C40YbQsNC8XCIsIG1lLl9qdXJpZGljYWxQZXJzb25zLCBuZXcgSnVyaWRpY2FsUGVyc29uc1JlYWRlcihtb2RlbCkpKVxyXG5cdFx0XHQudGhlbihmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR0cnkgeyBtb2RlbC5maW5pc2goKTsgfSBjYXRjaChleCkgeyByZXR1cm4gJC5EZWZlcnJlZCgpLnJlamVjdChleCk7IH1cclxuXHRcdFx0XHRtZS5fbW9kZWwuc3dhcChtb2RlbCk7XHJcblx0XHRcdFx0bWUuX21vZGVsLmNoYW5nZWQoKTtcclxuXHRcdFx0fSkpO1xyXG5cdH1cclxuXHJcblx0X29wZXJhdGlvbihmKSB7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cdFx0bWUuX29wZXJhdGlvblN0YXJ0KCk7XHJcblx0XHRyZXR1cm4gZigpXHJcblx0XHRcdC5kb25lKGZ1bmN0aW9uKCkgeyBtZS5fb3BlcmF0aW9uRW5kKCk7IH0pXHJcblx0XHRcdC5mYWlsKGZ1bmN0aW9uKGV4KSB7IG1lLl9vcGVyYXRpb25FbmQoZXgpOyB9KTtcclxuXHR9XHJcblx0X29wZXJhdGlvblN0YXJ0KCkge1xyXG5cdFx0aWYgKHRoaXMuX29wQ291bnRlcisrID09IDApXHJcblx0XHRcdHRoaXMub25PcGVyYXRpb25TdGFydC50cmlnZ2VyKCk7XHJcblx0fVxyXG5cdF9vcGVyYXRpb25FbmQoZXgpIHtcclxuXHRcdHRoaXMuX29wQ291bnRlciA9IE1hdGgubWF4KDEsIHRoaXMuX29wQ291bnRlcik7XHJcblx0XHRpZiAoLS10aGlzLl9vcENvdW50ZXIgPT0gMClcclxuXHRcdFx0dGhpcy5vbk9wZXJhdGlvbkVuZC50cmlnZ2VyKGV4KTtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTG9hZENvbnRyb2xsZXI7XHJcblxyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiYXBwL3V0aWxzXCIpO1xyXG52YXIgQWpheExvYWRlciA9IHJlcXVpcmUoXCJhcHAvQWpheExvYWRlclwiKTtcclxudmFyIEZpbGVMb2FkZXIgPSByZXF1aXJlKFwiYXBwL0ZpbGVMb2FkZXJcIik7XHJcbnZhciBNb2RlbCA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxcIik7XHJcbnZhciBQYXJ0aWNpcGFudHNSZWdpc3RyeVJlYWRlciA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvcmVhZGVycy9QYXJ0aWNpcGFudHNSZWdpc3RyeVJlYWRlclwiKTtcclxudmFyIE93bmVyc1JlZ2lzdHJ5UmVhZGVyID0gcmVxdWlyZShcImFwcC9tb2RlbC9yZWFkZXJzL093bmVyc1JlZ2lzdHJ5UmVhZGVyXCIpO1xyXG52YXIgQXBhcnRtZW50c1dpdGhvdXRTZWN0aW9uUmVhZGVyID0gcmVxdWlyZShcImFwcC9tb2RlbC9yZWFkZXJzL0FwYXJ0bWVudHNXaXRob3V0U2VjdGlvblJlYWRlclwiKTtcclxudmFyIEluY29ycmVjdEFwYXJ0bWVudHNSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvSW5jb3JyZWN0QXBhcnRtZW50c1JlYWRlclwiKTtcclxudmFyIE9sZEFwYXJ0bWVudE51bWJlcnNSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvT2xkQXBhcnRtZW50TnVtYmVyc1JlYWRlclwiKTtcclxudmFyIEp1cmlkaWNhbFBlcnNvbnNSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvSnVyaWRpY2FsUGVyc29uc1JlYWRlclwiKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWQoZGF0YURlc2NyaXB0aW9uLCBkYXRhLCByZWFkZXIpIC8qIC0+IERlZmVycmVkICovIHtcclxuXHR2YXIgZCA9ICQuRGVmZXJyZWQoKTtcclxuXHRpZiAoIWRhdGEpXHJcblx0XHRyZXR1cm4gZC5yZWplY3QobmV3IEVycm9yKFwi0J7RgtGB0YPRgtGB0YLQstGD0Y7RgiBcIiArIGRhdGFEZXNjcmlwdGlvbikpO1xyXG5cdHJlYWRlci5yZWFkKGRhdGEsIGZ1bmN0aW9uKGV4KSB7XHJcblx0XHRleCA/IGQucmVqZWN0KGV4KSA6IGQucmVzb2x2ZSgpO1xyXG5cdH0pO1xyXG5cdHJldHVybiBkO1xyXG59XHJcbiIsInZhciBVbmtub3duID0gXCI/Pz9cIjtcclxudmFyIENyb3NzID0gXCLinJVcIjtcclxuXHJcbmZ1bmN0aW9uIGZvcm1hdERhdGUoZGF0ZSkge1xyXG5cdHZhciBkYXkgPSAoXCIwXCIgKyBkYXRlLmdldERhdGUoKSkuc2xpY2UoLTIpO1xyXG5cdHZhciBtb250aCA9IChcIjBcIiArIChkYXRlLmdldE1vbnRoKCkgKyAxKSkuc2xpY2UoLTIpO1xyXG5cdHZhciB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cdHJldHVybiBgJHtkYXl9LiR7bW9udGh9LiR7eWVhcn1gO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRVbmtub3duLFxyXG5cdENyb3NzLFxyXG5cdGZvcm1hdERhdGUsXHJcbn07XHJcbiIsImNsYXNzIENzdkVycm9yIGV4dGVuZHMgRXJyb3Ige1xyXG5cdGNvbnN0cnVjdG9yKGxpbmUsIGlubmVyRXJyb3IpIHtcclxuXHRcdHN1cGVyKGDQntGI0LjQsdC60LAg0LIg0YHRgtGA0L7QutC1ICR7bGluZX06ICR7aW5uZXJFcnJvci5tZXNzYWdlfWApXHJcblx0XHR0aGlzLmxpbmUgPSBsaW5lO1xyXG5cdFx0dGhpcy5pbm5lckVycm9yID0gaW5uZXJFcnJvcjtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ3N2RXJyb3I7XHJcblxyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiYXBwL3V0aWxzXCIpO1xyXG4iLCJyZXF1aXJlKFwiYXBwL3BvbHlmaWxsc1wiKTtcclxuXHJcbnZhciBNYWluVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvTWFpblZpZXdcIik7XHJcbnZhciBJbmNvbXBhdGlibGVCcm93c2VyVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvSW5jb21wYXRpYmxlQnJvd3NlclZpZXdcIik7XHJcbnZhciBNb2RlbCA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxcIik7XHJcbnZhciBMb2FkQ29udHJvbGxlciA9IHJlcXVpcmUoXCJhcHAvTG9hZENvbnRyb2xsZXJcIik7XHJcblxyXG4kKGNoZWNrQnJvd3NlcigpID8gbWFpbiA6IGluY29tcGF0aWJsZUJyb3dzZXIpO1xyXG5cclxuZnVuY3Rpb24gY2hlY2tCcm93c2VyKCkge1xyXG5cdC8vIElFIGltcGxlbWVudGF0aW9uIG9mIGZsZXhib3ggaXMgdW5hY2NhcHRhYmxlIGJlY2F1c2Ugb2YgbnVtZXJvdXMgaGFyZC10by1maXggYnVnc1xyXG5cdGlmICgvTVNJRS8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSB8fCAvVHJpZGVudC8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSlcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHJcblx0cmV0dXJuIE1vZGVybml6ci5mbGV4d3JhcDtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbigpIHtcclxuXHJcblx0dmFyIG1vZGVsID0gbmV3IE1vZGVsKCk7XHJcblx0dmFyIGxvYWRDb250cm9sbGVyID0gbmV3IExvYWRDb250cm9sbGVyKG1vZGVsKTtcclxuXHJcblx0dmFyIG1haW5WaWV3ID0gbmV3IE1haW5WaWV3KG1vZGVsLCBsb2FkQ29udHJvbGxlcik7XHJcblx0bWFpblZpZXcuaW5zdGFsbCgkKGRvY3VtZW50LmJvZHkpKTtcclxuXHJcblx0bG9hZENvbnRyb2xsZXIuaW5pdCgpLnRoZW4oXHJcblx0XHRmdW5jdGlvbigpIHsgaWYgKCFtYWluVmlldy5nZXRBY3RpdmVUYWIoKSkgbWFpblZpZXcuc2V0QWN0aXZlVGFiKE1haW5WaWV3LlRhYi5HcmlkKTsgfSxcclxuXHRcdGZ1bmN0aW9uKCkgeyBpZiAoIW1haW5WaWV3LmdldEFjdGl2ZVRhYigpKSBtYWluVmlldy5zZXRBY3RpdmVUYWIoTWFpblZpZXcuVGFiLkRhdGEpOyB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5jb21wYXRpYmxlQnJvd3NlcigpIHtcclxuXHRuZXcgSW5jb21wYXRpYmxlQnJvd3NlclZpZXcoKS5pbnN0YWxsKCQoZG9jdW1lbnQuYm9keSkpO1xyXG59XHJcbiIsIu+7v2NsYXNzIE1vZGVsIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMucmVjb3JkcyA9IFtdO1xyXG5cdFx0dGhpcy5vYmplY3RzID0gW107XHJcblx0XHR0aGlzLl9vYmplY3RzQnlJZCA9IHt9O1xyXG5cdFx0dGhpcy5zcWxNb2RlbCA9IG5ldyBTcWxNb2RlbCgpO1xyXG5cdFx0dGhpcy5vbkNoYW5nZWQgPSBuZXcgdXRpbHMuRGVsZWdhdGUoKTtcclxuXHR9XHJcblx0YWRkUmVjb3JkKHJlY29yZCkge1xyXG5cdFx0dGhpcy5yZWNvcmRzLnB1c2gocmVjb3JkKTtcclxuXHR9XHJcblx0YWRkT2JqZWN0KG9iamVjdCkge1xyXG5cdFx0dGhpcy5vYmplY3RzLnB1c2gob2JqZWN0KTtcclxuXHR9XHJcblxyXG5cdC8vIE1vZGlmaWNhdGlvbiBvcGVyYXRpb25zXHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRyZW1vdmVPYmplY3Qob2JqZWN0KSB7XHJcblx0XHR1dGlscy5BcnJheXMucmVtb3ZlRmlyc3QodGhpcy5vYmplY3RzLCBvYmplY3QpO1xyXG5cdH1cclxuXHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRmaW5pc2goKSB7XHJcblx0XHQvLyAxLiBhc3NpZ24gaWRzXHJcblx0XHQvLyAyLiBmaWxsIGFycmF5IG9mIG9iamVjdHMgaW4gZWFjaCByZWNvcmRcclxuXHRcdGZvciAodmFyIGkgPSAwLCBjID0gdGhpcy5yZWNvcmRzLmxlbmd0aDsgaSA8IGM7IGkrKykge1xyXG5cdFx0XHR2YXIgcmVjb3JkID0gdGhpcy5yZWNvcmRzW2ldO1xyXG5cdFx0XHRyZWNvcmQuaWQgPSBpKzE7XHJcblx0XHRcdHJlY29yZC5vYmplY3RzID0gW107XHJcblx0XHR9XHJcblx0XHR0aGlzLl9vYmplY3RzQnlJZCA9IHt9O1xyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGMgPSB0aGlzLm9iamVjdHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHRcdHZhciBvYmogPSB0aGlzLm9iamVjdHNbaV07XHJcblx0XHRcdG9iai5pZCA9IGkrMTtcclxuXHRcdFx0dGhpcy5fb2JqZWN0c0J5SWRbb2JqLmlkXSA9IG9iajtcclxuXHRcdFx0b2JqLnJlY29yZC5vYmplY3RzLnB1c2gob2JqKTtcclxuXHRcdH1cclxuXHJcblx0XHRzZWFyY2hEdXBsaWNhdGVzKHRoaXMub2JqZWN0cyk7XHJcblxyXG5cdFx0dGhpcy5zcWxNb2RlbC5pbml0KHRoaXMpO1xyXG5cdH1cclxuXHRzd2FwKG90aGVyKSB7XHJcblx0XHR2YXIgdG1wO1xyXG5cclxuXHRcdHRtcCA9IHRoaXMucmVjb3JkcztcclxuXHRcdHRoaXMucmVjb3JkcyA9IG90aGVyLnJlY29yZHM7XHJcblx0XHRvdGhlci5yZWNvcmRzID0gdG1wO1xyXG5cclxuXHRcdHRtcCA9IHRoaXMub2JqZWN0cztcclxuXHRcdHRoaXMub2JqZWN0cyA9IG90aGVyLm9iamVjdHM7XHJcblx0XHRvdGhlci5vYmplY3RzID0gdG1wO1xyXG5cclxuXHRcdHRtcCA9IHRoaXMuX29iamVjdHNCeUlkO1xyXG5cdFx0dGhpcy5fb2JqZWN0c0J5SWQgPSBvdGhlci5fb2JqZWN0c0J5SWQ7XHJcblx0XHRvdGhlci5fb2JqZWN0c0J5SWQgPSB0bXA7XHJcblxyXG5cdFx0dGhpcy5zcWxNb2RlbC5zd2FwKG90aGVyLnNxbE1vZGVsKTtcclxuXHR9XHJcblx0Y2hhbmdlZCgpIHtcclxuXHRcdHRoaXMub25DaGFuZ2VkLnRyaWdnZXIoKTtcclxuXHR9XHJcblxyXG5cdC8vIFF1ZXJ5IG9wZXJhdGlvbnNcclxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5cdGdldE9iamVjdEJ5SWQob2JqZWN0SWQpIHtcclxuXHRcdHJldHVybiB0aGlzLl9vYmplY3RzQnlJZFtvYmplY3RJZF07XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxudmFyIFNxbE1vZGVsID0gcmVxdWlyZShcImFwcC9tb2RlbC9TcWxNb2RlbFwiKTtcclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlc1wiKTtcclxuXHJcbmZ1bmN0aW9uIHNlYXJjaER1cGxpY2F0ZXMob2JqZWN0cykge1xyXG5cdHZhciBtYXAgPSB7fTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGMgPSBvYmplY3RzLmxlbmd0aDsgaSA8IGM7IGkrKykge1xyXG5cdFx0dmFyIG9iaiA9IG9iamVjdHNbaV07XHJcblx0XHRpZiAoIShvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudCkgfHwgb2JqLnNlY3Rpb24gPT0gbnVsbClcclxuXHRcdFx0Y29udGludWU7XHJcblxyXG5cdFx0dmFyIGR1cCA9IG9wdGlvbmFsbHlJbnNlcnQoXHJcblx0XHRcdG9wdGlvbmFsbHlJbnNlcnQoXHJcblx0XHRcdFx0b3B0aW9uYWxseUluc2VydChcclxuXHRcdFx0XHRcdG9wdGlvbmFsbHlJbnNlcnQobWFwLCBvYmouYnVpbGRpbmcpLFxyXG5cdFx0XHRcdFx0b2JqLnNlY3Rpb24pLFxyXG5cdFx0XHRcdG9iai5mbG9vciksXHJcblx0XHRcdG9iai5udW1iZXIsXHJcblx0XHRcdG9iaik7XHJcblx0XHRpZiAoZHVwICE9PSBvYmopIHtcclxuXHRcdFx0ZHVwLmR1cGxpY2F0ZSA9IHRydWU7XHJcblx0XHRcdG9iai5kdXBsaWNhdGUgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gb3B0aW9uYWxseUluc2VydChtYXAsIGtleSwgdmFsdWUgLyogPSB7fSAqLykge1xyXG5cdGlmIChtYXAuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuXHRcdHJldHVybiBtYXBba2V5XTtcclxuXHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcclxuXHRcdHZhbHVlID0ge307XHJcblx0bWFwW2tleV0gPSB2YWx1ZTtcclxuXHRyZXR1cm4gdmFsdWU7XHJcbn1cclxuIiwi77u/Y2xhc3MgUmVjb3JkIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuaWQgPSBudWxsOyAvLyBhc3NpZ25lZCBieSBNb2RlbFxyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgUGFydGljaXBhbnRzUmVnaXN0cnlSZWNvcmQgZXh0ZW5kcyBSZWNvcmQge1xyXG5cdGNvbnN0cnVjdG9yKG51bWJlciwgcmVnaXN0cnlOdW1iZXIsIGRhdGUsIHNvdXJjZSkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMubnVtYmVyID0gbnVtYmVyO1xyXG5cdFx0dGhpcy5yZWdpc3RyeU51bWJlciA9IHJlZ2lzdHJ5TnVtYmVyO1xyXG5cdFx0dGhpcy5kYXRlID0gZGF0ZTtcclxuXHRcdHRoaXMub3duZXIgPSBudWxsO1xyXG5cdFx0dGhpcy5zb3VyY2UgPSBzb3VyY2U7XHJcblx0fVxyXG59XHJcblBhcnRpY2lwYW50c1JlZ2lzdHJ5UmVjb3JkLnByb3RvdHlwZS50eXBlID0gXCLQldCT0KDQn1wiO1xyXG5cclxuY2xhc3MgT3duZXJzUmVnaXN0cnlSZWNvcmQgZXh0ZW5kcyBSZWNvcmQge1xyXG5cdGNvbnN0cnVjdG9yKG51bWJlciwgb3duZXIpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLm51bWJlciA9IG51bWJlcjtcclxuXHRcdHRoaXMub3duZXIgPSBvd25lcjtcclxuXHR9XHJcbn1cclxuT3duZXJzUmVnaXN0cnlSZWNvcmQucHJvdG90eXBlLnR5cGUgPSBcItCg0LXQtdGB0YLRgCDRgdC+0LHRgdGC0LLQtdC90L3QuNC60L7QsiDQtNC+0LvQtdC5XCI7XHJcblxyXG5cclxuY2xhc3MgT2JqIHtcclxuXHRjb25zdHJ1Y3RvcihyZWNvcmQpIHtcclxuXHRcdHRoaXMuaWQgPSBudWxsOyAvLyBhc3NpZ25lZCBieSBNb2RlbFxyXG5cdFx0dGhpcy5yZWNvcmQgPSByZWNvcmQ7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBQYXJraW5nUGxhY2UgZXh0ZW5kcyBPYmoge1xyXG5cdGNvbnN0cnVjdG9yKHJlY29yZCwgbnVtYmVyLCBidWlsZGluZywgYXJlYSkge1xyXG5cdFx0c3VwZXIocmVjb3JkKTtcclxuXHRcdHRoaXMubnVtYmVyID0gbnVtYmVyO1xyXG5cdFx0dGhpcy5idWlsZGluZyA9IGJ1aWxkaW5nO1xyXG5cdFx0dGhpcy5hcmVhID0gYXJlYTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEFwYXJ0bWVudCBleHRlbmRzIE9iaiB7XHJcblx0Y29uc3RydWN0b3IocmVjb3JkLCB0eXBlLCBudW1iZXIsIGJ1aWxkaW5nLCBmbG9vciwgbGFuZGluZ051bWJlciwgc2VjdGlvbiwgYXJlYSkge1xyXG5cdFx0c3VwZXIocmVjb3JkKTtcclxuXHRcdHRoaXMudHlwZSA9IHR5cGU7XHJcblx0XHR0aGlzLm51bWJlciA9IG51bWJlcjtcclxuXHRcdHRoaXMub3JpZ2luYWxOdW1iZXIgPSBudWxsO1xyXG5cdFx0dGhpcy5idWlsZGluZyA9IGJ1aWxkaW5nO1xyXG5cdFx0dGhpcy5mbG9vciA9IGZsb29yO1xyXG5cdFx0dGhpcy5sYW5kaW5nTnVtYmVyID0gbGFuZGluZ051bWJlcjtcclxuXHRcdHRoaXMuc2VjdGlvbiA9IHNlY3Rpb247XHJcblx0XHR0aGlzLmFyZWEgPSBhcmVhO1xyXG5cdFx0dGhpcy5kdXBsaWNhdGUgPSBmYWxzZTsgLy8gYXNzaWduZWQgYnkgTW9kZWxcclxuXHR9XHJcblx0c2V0TnVtYmVyKG51bWJlcikge1xyXG5cdFx0aWYgKHRoaXMub3JpZ2luYWxOdW1iZXIgIT0gbnVsbClcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0JjRgdGF0L7QtNC90YvQuSDQvdC+0LzQtdGAINC60LLQsNGA0YLQuNGA0Ysg0YPQttC1INC30LDQtNCw0L06IFwiICsgdGhpcy5vcmlnaW5hbE51bWJlcik7XHJcblx0XHR0aGlzLm9yaWdpbmFsTnVtYmVyID0gdGhpcy5udW1iZXI7XHJcblx0XHR0aGlzLm51bWJlciA9IG51bWJlcjtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIE5vblJlc2lkZW50aWFsUHJlbWlzZSBleHRlbmRzIE9iaiB7XHJcblx0Y29uc3RydWN0b3IocmVjb3JkLCB0eXBlLCBudW1iZXIsIGJ1aWxkaW5nLCBzZWN0aW9uLCBhcmVhKSB7XHJcblx0XHRzdXBlcihyZWNvcmQpO1xyXG5cdFx0dGhpcy50eXBlID0gdHlwZTtcclxuXHRcdHRoaXMubnVtYmVyID0gbnVtYmVyO1xyXG5cdFx0dGhpcy5idWlsZGluZyA9IGJ1aWxkaW5nO1xyXG5cdFx0dGhpcy5zZWN0aW9uID0gc2VjdGlvbjtcclxuXHRcdHRoaXMuYXJlYSA9IGFyZWE7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRSZWNvcmQsIFBhcnRpY2lwYW50c1JlZ2lzdHJ5UmVjb3JkLCBPd25lcnNSZWdpc3RyeVJlY29yZCxcclxuXHRPYmosIFBhcmtpbmdQbGFjZSwgQXBhcnRtZW50LCBOb25SZXNpZGVudGlhbFByZW1pc2UsXHJcbn07XHJcbiIsImNsYXNzIFJlY29yZFNlbGVjdGlvbk1vZGVsIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX3JlY29yZCA9IG51bGw7XHJcblx0XHR0aGlzLm9uQ2hhbmdlZCA9IG5ldyB1dGlscy5EZWxlZ2F0ZSgpO1xyXG5cdH1cclxuXHRzZXRSZWNvcmQoLyogb3B0aW9uYWwgKi8gcmVjb3JkKSB7XHJcblx0XHRpZiAocmVjb3JkID09IHRoaXMuX3JlY29yZCkgcmV0dXJuO1xyXG5cdFx0dGhpcy5fcmVjb3JkID0gcmVjb3JkO1xyXG5cdFx0dGhpcy5vbkNoYW5nZWQudHJpZ2dlcigpO1xyXG5cdH1cclxuXHRjbGVhcigpIHtcclxuXHRcdHRoaXMuc2V0UmVjb3JkKG51bGwpO1xyXG5cdH1cclxuXHRnZXRSZWNvcmQoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fcmVjb3JkO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZWNvcmRTZWxlY3Rpb25Nb2RlbDtcclxuXHJcbnZhciB1dGlscyA9IHJlcXVpcmUoXCJhcHAvdXRpbHNcIik7XHJcbiIsImNsYXNzIFNlYXJjaE1vZGVsIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX2lkcyA9IFtdO1xyXG5cdFx0dGhpcy5vbkNoYW5nZWQgPSBuZXcgdXRpbHMuRGVsZWdhdGUoKTtcclxuXHR9XHJcblx0c2V0T2JqZWN0SWRzKHZhbHVlKSB7XHJcblx0XHRpZiAodGhpcy5faWRzLmxlbmd0aCA9PSAwICYmIHZhbHVlLmxlbmd0aCA9PSAwKSB7XHJcblx0XHRcdC8vIG9taXQgb25DaGFuZ2VkIGluIHRoaXMgY29tbW9uIGNhc2VcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5faWRzID0gdmFsdWU7XHJcblx0XHR0aGlzLm9uQ2hhbmdlZC50cmlnZ2VyKCk7XHJcblx0fVxyXG5cdGdldE9iamVjdElkcygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9pZHM7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNlYXJjaE1vZGVsO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxuIiwi77u/dmFyIFNjaGVtYSA9IGBcclxuY3JlYXRlIHRhYmxlIFJlY29yZCAoXHJcblx0aWQgaW50IG5vdCBudWxsIHByaW1hcnkga2V5LFxyXG5cdHR5cGUgdGV4dCBub3QgbnVsbCxcclxuXHRudW1iZXIgaW50IG5vdCBudWxsLFxyXG5cdHJlZ2lzdHJ5TnVtYmVyIHRleHQsXHJcblx0W2RhdGVdIGRhdGUsXHJcblx0b3duZXIgdGV4dCxcclxuXHRzb3VyY2UgdGV4dFxyXG4pO1xyXG5cclxuY3JlYXRlIHRhYmxlIFBhcmtpbmdQbGFjZSAoXHJcblx0aWQgaW50IG5vdCBudWxsIHByaW1hcnkga2V5LFxyXG5cdHJlY29yZElkIGludCBub3QgbnVsbCByZWZlcmVuY2VzIFJlY29yZChpZCksXHJcblx0bnVtYmVyIGludCBub3QgbnVsbCxcclxuXHRidWlsZGluZyBpbnQgbm90IG51bGwsXHJcblx0YXJlYSBudW1iZXIgbm90IG51bGxcclxuKTtcclxuXHJcbmNyZWF0ZSB0YWJsZSBBcGFydG1lbnQgKFxyXG5cdGlkIGludCBub3QgbnVsbCBwcmltYXJ5IGtleSxcclxuXHRyZWNvcmRJZCBpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBSZWNvcmQoaWQpLFxyXG5cdHR5cGUgdGV4dCBub3QgbnVsbCxcclxuXHRudW1iZXIgaW50IG5vdCBudWxsLFxyXG5cdG9yaWdpbmFsTnVtYmVyIGludCxcclxuXHRidWlsZGluZyBpbnQgbm90IG51bGwsXHJcblx0Zmxvb3IgaW50IG5vdCBudWxsLFxyXG5cdGxhbmRpbmdOdW1iZXIgaW50LFxyXG5cdHNlY3Rpb24gaW50IG51bGwsXHJcblx0YXJlYSBudW1iZXIgbm90IG51bGwsXHJcblx0ZHVwbGljYXRlIGJvb2wgbm90IG51bGxcclxuKTtcclxuXHJcbi8qIE5vbi1SZXNpZGVudGlhbCBQcmVtaXNlICovXHJcbmNyZWF0ZSB0YWJsZSBOUlByZW1pc2UgKFxyXG5cdGlkIGludCBub3QgbnVsbCBwcmltYXJ5IGtleSxcclxuXHRyZWNvcmRJZCBpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBSZWNvcmQoaWQpLFxyXG5cdHR5cGUgdGV4dCBub3QgbnVsbCxcclxuXHRudW1iZXIgaW50IG51bGwsXHJcblx0YnVpbGRpbmcgaW50IG5vdCBudWxsLFxyXG5cdHNlY3Rpb24gaW50IG51bGwsXHJcblx0YXJlYSBudW1iZXIgbm90IG51bGxcclxuKTtcclxuYC50cmltKCk7XHJcblxyXG5jbGFzcyBTcWxNb2RlbCB7XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRnbG9iYWxJbml0KCk7XHJcblx0XHR0aGlzLmRiID0gbmV3IGFsYXNxbC5EYXRhYmFzZSgpO1xyXG5cdFx0aW5pdERiKHRoaXMuZGIpO1xyXG5cdH1cclxuXHRpbml0KG1vZGVsKSB7XHJcblx0XHR2YXIgZGIgPSBuZXcgYWxhc3FsLkRhdGFiYXNlKCk7XHJcblx0XHRpbml0RGIoZGIpO1xyXG5cdFx0bG9hZE1vZGVsKGRiLCBtb2RlbCk7XHJcblx0XHR0aGlzLmRiID0gZGI7XHJcblx0fVxyXG5cdHF1ZXJ5KHNxbCkgLyogLT4gW11bXVtdICovIHtcclxuXHRcdHZhciByZXMgPSB0aGlzLmRiLmV4ZWMoc3FsKTtcclxuXHRcdGlmIChyZXMubGVuZ3RoID4gMCAmJiByZXNbMF0ubGVuZ3RoID4gMCAmJiAkLmlzQXJyYXkocmVzWzBdWzBdKSkge1xyXG5cdFx0XHQvLyBhbGFzcWwgcmV0dXJuZWQgbXVsdGlwbGUgZGF0YXNldHNcclxuXHRcdFx0cmV0dXJuIHJlcztcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHQvLyBhbGFzcWwgcmV0dXJuZWQgc2luZ2xlIGRhdGFzZXRcclxuXHRcdFx0cmV0dXJuIFtyZXNdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRzd2FwKG90aGVyKSB7XHJcblx0XHR2YXIgdG1wID0gdGhpcy5kYjtcclxuXHRcdHRoaXMuZGIgPSBvdGhlci5kYjtcclxuXHRcdG90aGVyLmRiID0gdG1wO1xyXG5cdH1cclxufVxyXG5cclxuU3FsTW9kZWwuU2NoZW1hID0gU2NoZW1hO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTcWxNb2RlbDtcclxuXHJcbnZhciBtID0gcmVxdWlyZShcImFwcC9tb2RlbC9Nb2RlbENsYXNzZXNcIik7XHJcblxyXG5mdW5jdGlvbiBnbG9iYWxJbml0KCkge1xyXG5cdGFsYXNxbC5vcHRpb25zLmNhc2VzZW5zaXRpdmUgPSBcImZhbHNlXCI7XHJcblx0Ly8gcmV0dXJuIHJvd3MgYXMgYXJyYXlzLCBub3Qgb2JqZWN0c1xyXG5cdGFsYXNxbC5vcHRpb25zLm1vZGlmaWVyID0gXCJNQVRSSVhcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdERiKGRiKSB7XHJcblx0ZGIuZXhlYyhTY2hlbWEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBsb2FkTW9kZWwoZGIsIG1vZGVsKSB7XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBjID0gbW9kZWwub2JqZWN0cy5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdHZhciBvYmogPSBtb2RlbC5vYmplY3RzW2ldO1xyXG5cdFx0b2JqLnJlY29yZElkID0gb2JqLnJlY29yZC5pZDtcclxuXHR9XHJcblxyXG5cdHZhciBSZWNvcmQgPSBtb2RlbC5yZWNvcmRzO1xyXG5cclxuXHR2YXIgUGFya2luZ1BsYWNlID0gbW9kZWwub2JqZWN0cy5maWx0ZXIoZnVuY3Rpb24ob2JqKSB7XHJcblx0XHRyZXR1cm4gb2JqIGluc3RhbmNlb2YgbS5QYXJraW5nUGxhY2U7XHJcblx0fSk7XHJcblx0dmFyIEFwYXJ0bWVudCA9IG1vZGVsLm9iamVjdHMuZmlsdGVyKGZ1bmN0aW9uKG9iaikge1xyXG5cdFx0cmV0dXJuIG9iaiBpbnN0YW5jZW9mIG0uQXBhcnRtZW50O1xyXG5cdH0pO1xyXG5cdHZhciBOUlByZW1pc2UgPSBtb2RlbC5vYmplY3RzLmZpbHRlcihmdW5jdGlvbihvYmopIHtcclxuXHRcdHJldHVybiBvYmogaW5zdGFuY2VvZiBtLk5vblJlc2lkZW50aWFsUHJlbWlzZTtcclxuXHR9KTtcclxuXHJcblx0ZGIuZXhlYyhgXHJcblx0XHRJTlNFUlQgSU5UTyBSZWNvcmQoaWQsIHR5cGUsIG51bWJlciwgcmVnaXN0cnlOdW1iZXIsIFtkYXRlXSwgb3duZXIsIHNvdXJjZSlcclxuXHRcdFNFTEVDVCBpZCwgdHlwZSwgbnVtYmVyLCByZWdpc3RyeU51bWJlciwgW2RhdGVdLCBvd25lciwgc291cmNlXHJcblx0XHRGUk9NID87XHJcblxyXG5cdFx0SU5TRVJUIElOVE8gUGFya2luZ1BsYWNlKGlkLCByZWNvcmRJZCwgbnVtYmVyLCBidWlsZGluZywgYXJlYSlcclxuXHRcdFNFTEVDVCBpZCwgcmVjb3JkSWQsIG51bWJlciwgYnVpbGRpbmcsIGFyZWFcclxuXHRcdEZST00gPztcclxuXHJcblx0XHRJTlNFUlQgSU5UTyBBcGFydG1lbnQoaWQsIHJlY29yZElkLCB0eXBlLCBudW1iZXIsIG9yaWdpbmFsTnVtYmVyLCBidWlsZGluZywgZmxvb3IsIGxhbmRpbmdOdW1iZXIsIHNlY3Rpb24sIGFyZWEsIGR1cGxpY2F0ZSlcclxuXHRcdFNFTEVDVCBpZCwgcmVjb3JkSWQsIHR5cGUsIG51bWJlciwgb3JpZ2luYWxOdW1iZXIsIGJ1aWxkaW5nLCBmbG9vciwgbGFuZGluZ051bWJlciwgc2VjdGlvbiwgYXJlYSwgZHVwbGljYXRlXHJcblx0XHRGUk9NID87XHJcblxyXG5cdFx0SU5TRVJUIElOVE8gTlJQcmVtaXNlKGlkLCByZWNvcmRJZCwgdHlwZSwgbnVtYmVyLCBidWlsZGluZywgc2VjdGlvbiwgYXJlYSlcclxuXHRcdFNFTEVDVCBpZCwgcmVjb3JkSWQsIHR5cGUsIG51bWJlciwgYnVpbGRpbmcsIHNlY3Rpb24sIGFyZWFcclxuXHRcdEZST00gPztcclxuXHRgLCBbUmVjb3JkLCBQYXJraW5nUGxhY2UsIEFwYXJ0bWVudCwgTlJQcmVtaXNlXSk7XHJcbn1cclxuIiwidmFyIEJhc2VDc3ZSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvQmFzZUNzdlJlYWRlclwiKTtcclxuXHJcbmNsYXNzIEFwYXJ0bWVudHNXaXRob3V0U2VjdGlvblJlYWRlciBleHRlbmRzIEJhc2VDc3ZSZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKG1vZGVsKSB7XHJcblx0XHRzdXBlcih7XHJcblx0XHRcdHNraXBSb3dzOiAxXHJcblx0XHR9KTtcclxuXHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XHJcblx0fVxyXG5cdC8vIEBvdmVycmlkZVxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cclxuXHRcdHZhciBzZWN0aW9uID0gUGFyc2luZy5wYXJzZVNlY3Rpb24ocmVjb3JkWzBdKTtcclxuXHRcdHZhciBmbG9vciA9IFBhcnNpbmcucGFyc2VGbG9vcihyZWNvcmRbMV0pO1xyXG5cdFx0dmFyIG51bWJlciA9IFBhcnNpbmcucGFyc2VOdW1iZXIocmVjb3JkWzJdKTtcclxuXHRcdHZhciByZWNvcmROdW1iZXIgPSBQYXJzaW5nLnBhcnNlUmVjb3JkTnVtYmVyKHJlY29yZFszXSk7XHJcblxyXG5cdFx0dmFyIG9iamVjdHMgPSB0aGlzLl9tb2RlbC5vYmplY3RzO1xyXG5cdFx0dmFyIGZvdW5kT2JqZWN0ID0gbnVsbDtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBjID0gb2JqZWN0cy5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdFx0dmFyIG9iaiA9IG9iamVjdHNbaV07XHJcblx0XHRcdGlmIChvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudCAmJlxyXG5cdFx0XHRcdG9iai5mbG9vciA9PSBmbG9vciAmJlxyXG5cdFx0XHRcdG9iai5udW1iZXIgPT0gbnVtYmVyICYmXHJcblx0XHRcdFx0b2JqLnNlY3Rpb24gPT0gbnVsbCAmJlxyXG5cdFx0XHRcdG9iai5yZWNvcmQubnVtYmVyID09IHJlY29yZE51bWJlcikge1xyXG5cclxuXHRcdFx0XHR2YXIgX3JlY29yZCA9IG9iai5yZWNvcmQ7XHJcblx0XHRcdFx0aWYgKCEoX3JlY29yZCBpbnN0YW5jZW9mIG0uUGFydGljaXBhbnRzUmVnaXN0cnlSZWNvcmQpKVxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QsNC50LTQtdC90L3QsNGPINC30LDQv9C40YHRjCDQuNC80LXQtdGCINC90LXQutC+0YDRgNC10LrRgtC90YvQuSDRgtC40L86IFwiICsgX3JlY29yZC50eXBlKTtcclxuXHJcblx0XHRcdFx0aWYgKGZvdW5kT2JqZWN0ICE9IG51bGwpXHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLQndCw0LnQtNC10L3QviDQvdC10YHQutC+0LvRjNC60L4g0L/QvtC00YXQvtC00Y/RidC40YUg0LfQsNC/0LjRgdC10Lk7INC00L7Qu9C20L3QsCDQsdGL0YLRjCDQvtC00L3QsFwiKTtcclxuXHRcdFx0XHRmb3VuZE9iamVjdCA9IG9iajtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKCFmb3VuZE9iamVjdClcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0JfQsNC/0LjRgdGMINC90LUg0L3QsNC50LTQtdC90LBcIik7XHJcblx0XHRmb3VuZE9iamVjdC5zZWN0aW9uID0gc2VjdGlvbjtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQXBhcnRtZW50c1dpdGhvdXRTZWN0aW9uUmVhZGVyO1xyXG5cclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlc1wiKTtcclxudmFyIFBhcnNpbmcgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvUGFyc2luZ1wiKTtcclxuIiwiY2xhc3MgQmFzZUNzdlJlYWRlciB7XHJcblx0Ly8gY29uZmlnOiB7XHJcblx0Ly8gICBza2lwUm93cyAvKiA9IDAgKi9cclxuXHQvLyB9XHJcblx0Y29uc3RydWN0b3IoY29uZmlnKSB7XHJcblx0XHR0aGlzLl9jb25maWcgPSBjb25maWcgfHwge307XHJcblx0fVxyXG5cdHJlYWQoY3N2LCBjYWxsYmFjaykge1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHJcblx0XHR2YXIgcmVhZGFibGUgPSBuZXcgc3RyZWFtLlJlYWRhYmxlKCk7XHJcblx0XHRyZWFkYWJsZS5wdXNoKGNzdik7XHJcblx0XHRyZWFkYWJsZS5wdXNoKG51bGwpO1xyXG5cclxuXHRcdHZhciBwYXJzZXIgPSBwYXJzZSh7XHJcblx0XHRcdGRlbGltaXRlcjogXCJcXHRcIixcclxuXHRcdFx0cmVsYXhfY29sdW1uX2NvdW50OiB0cnVlLFxyXG5cdFx0fSk7XHJcblx0XHRyZWFkYWJsZS5waXBlKHBhcnNlcik7XHJcblxyXG5cdFx0dmFyIHNraXBSb3dzID0gdGhpcy5fY29uZmlnLnNraXBSb3dzIHx8IDA7XHJcblx0XHRwYXJzZXIub24oXCJyZWFkYWJsZVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHJlY29yZDtcclxuXHRcdFx0d2hpbGUgKChyZWNvcmQgPSBwYXJzZXIucmVhZCgpKSkge1xyXG5cdFx0XHRcdGlmIChza2lwUm93cyA+IDApIHtcclxuXHRcdFx0XHRcdC0tc2tpcFJvd3M7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVjb3JkID0gcmVjb3JkLm1hcCh4ID0+IHgudHJpbSgpKTtcclxuXHRcdFx0XHRtZS5fcHJvY2Vzc1JlY29yZChyZWNvcmQpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdHBhcnNlci5vbihcImVycm9yXCIsIGZ1bmN0aW9uKGV4KSB7XHJcblx0XHRcdHZhciBlcnIgPSBuZXcgQ3N2RXJyb3IocGFyc2VyLmxpbmVzLCBleCk7XHJcblx0XHRcdG1lLl9maW5pc2goZXJyKTtcclxuXHRcdFx0Y2FsbGJhY2soZXJyKTtcclxuXHRcdH0pO1xyXG5cdFx0cGFyc2VyLm9uKFwiZmluaXNoXCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgZXJyID0gbnVsbDtcclxuXHRcdFx0bWUuX2ZpbmlzaChlcnIpO1xyXG5cdFx0XHRjYWxsYmFjayhlcnIpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdC8vIEBhYnN0cmFjdFxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xyXG5cdH1cclxuXHQvLyBAdmlydHVhbFxyXG5cdF9maW5pc2goLyogb3B0aW9uYWwgKi8gZXJyKSB7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VDc3ZSZWFkZXI7XHJcblxyXG52YXIgcGFyc2UgPSByZXF1aXJlKFwiY3N2LXBhcnNlXCIpO1xyXG52YXIgc3RyZWFtID0gcmVxdWlyZShcInN0cmVhbVwiKTtcclxudmFyIENzdkVycm9yID0gcmVxdWlyZShcImFwcC9leGNlcHRpb25zL0NzdkVycm9yXCIpO1xyXG4iLCJ2YXIgQmFzZUNzdlJlYWRlciA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvcmVhZGVycy9CYXNlQ3N2UmVhZGVyXCIpO1xyXG5cclxuY2xhc3MgSW5jb3JyZWN0QXBhcnRtZW50c1JlYWRlciBleHRlbmRzIEJhc2VDc3ZSZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKG1vZGVsKSB7XHJcblx0XHRzdXBlcih7XHJcblx0XHRcdHNraXBSb3dzOiAxXHJcblx0XHR9KTtcclxuXHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XHJcblx0fVxyXG5cdC8vIEBvdmVycmlkZVxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cclxuXHRcdHZhciByZWNvcmROdW1iZXIgPSBQYXJzaW5nLnBhcnNlUmVjb3JkTnVtYmVyKHJlY29yZFswXSk7XHJcblx0XHR2YXIgbnVtYmVyID0gUGFyc2luZy5wYXJzZU51bWJlcihyZWNvcmRbMV0pO1xyXG5cclxuXHRcdHZhciBvYmplY3RzID0gdGhpcy5fbW9kZWwub2JqZWN0cztcclxuXHRcdHZhciBmb3VuZE9iamVjdCA9IG51bGw7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgYyA9IG9iamVjdHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHRcdHZhciBvYmogPSBvYmplY3RzW2ldO1xyXG5cdFx0XHRpZiAob2JqIGluc3RhbmNlb2YgbS5BcGFydG1lbnQgJiZcclxuXHRcdFx0XHRvYmoucmVjb3JkLm51bWJlciA9PSByZWNvcmROdW1iZXIgJiZcclxuXHRcdFx0XHRvYmoubnVtYmVyID09IG51bWJlcikge1xyXG5cclxuXHRcdFx0XHRpZiAoZm91bmRPYmplY3QgIT0gbnVsbClcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihcItCd0LDQudC00LXQvdC+INC90LXRgdC60L7Qu9GM0LrQviDQv9C+0LTRhdC+0LTRj9GJ0LjRhSDQt9Cw0L/QuNGB0LXQuTsg0LTQvtC70LbQvdCwINCx0YvRgtGMINC+0LTQvdCwXCIpO1xyXG5cdFx0XHRcdGZvdW5kT2JqZWN0ID0gb2JqO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRpZiAoIWZvdW5kT2JqZWN0KVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLQl9Cw0L/QuNGB0Ywg0L3QtSDQvdCw0LnQtNC10L3QsFwiKTtcclxuXHRcdHRoaXMuX21vZGVsLnJlbW92ZU9iamVjdChmb3VuZE9iamVjdCk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEluY29ycmVjdEFwYXJ0bWVudHNSZWFkZXI7XHJcblxyXG52YXIgbSA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxDbGFzc2VzXCIpO1xyXG52YXIgUGFyc2luZyA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvcmVhZGVycy9QYXJzaW5nXCIpO1xyXG5cclxuIiwidmFyIEJhc2VDc3ZSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvQmFzZUNzdlJlYWRlclwiKTtcclxuXHJcbmNsYXNzIEp1cmlkaWNhbFBlcnNvbnNSZWFkZXIgZXh0ZW5kcyBCYXNlQ3N2UmVhZGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihtb2RlbCkge1xyXG5cdFx0c3VwZXIoe1xyXG5cdFx0XHRza2lwUm93czogMVxyXG5cdFx0fSk7XHJcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xyXG5cdFx0dGhpcy5fc2VhcmNoU3RyaW5ncyA9IFtdO1xyXG5cdH1cclxuXHQvLyBAb3ZlcnJpZGVcclxuXHRfcHJvY2Vzc1JlY29yZChyZWNvcmQpIHtcclxuXHRcdHRoaXMuX3NlYXJjaFN0cmluZ3MucHVzaChyZWNvcmRbMF0udG9Mb3dlckNhc2UoKSk7XHJcblx0fVxyXG5cdF9maW5pc2goKSB7XHJcblx0XHR2YXIgcmVjb3JkcyA9IHRoaXMuX21vZGVsLnJlY29yZHM7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgYyA9IHJlY29yZHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHRcdHZhciByZWNvcmQgPSByZWNvcmRzW2ldO1xyXG5cdFx0XHRpZiAocmVjb3JkIGluc3RhbmNlb2YgbS5QYXJ0aWNpcGFudHNSZWdpc3RyeVJlY29yZClcclxuXHRcdFx0XHRleHRyYWN0T3duZXIocmVjb3JkLCB0aGlzLl9zZWFyY2hTdHJpbmdzKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RPd25lcihyZWNvcmQsIGp1cmlkaWNhbFBlcnNvbnNTZWFyY2hTdHJpbmdzKSB7XHJcblx0dmFyIG0gPSByZWNvcmQuc291cmNlLm1hdGNoKC/Qo9GH0LDRgdGC0L3QuNC60Lgg0LTQvtC70LXQstC+0LPQvlxcbiguKj8pKFxcbnwkKS9pKTtcclxuXHRpZiAoIW0pXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCLQkiDQt9Cw0L/QuNGB0Lgg0L3QtSDQvdCw0LnQtNC10L3RiyDQtNCw0L3QvdGL0LUg0L7QsSDRg9GH0LDRgdGC0L3QuNC60LDRhSDQtNC+0LvQtdCy0L7Qs9C+INGB0YLRgNC+0LjRgtC10LvRjNGB0YLQstCwXCIpO1xyXG5cclxuXHQvLyBzZXQgYHJlY29yZC5vd25lcmAgdG8gdGhlIG5hbWUgb2YgdGhlIHBoeXNpY2FsIHBlcnNvblxyXG5cdC8vIGZvciBqdXJpZGljYWwgcGVyc29ucyBgb3duZXJgIHJlbWFpbnMgYG51bGxgXHJcblx0dmFyIG93bmVyID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xyXG5cdGlmICghanVyaWRpY2FsUGVyc29uc1NlYXJjaFN0cmluZ3Muc29tZShzZWFyY2hTdHJpbmcgPT4gb3duZXIuaW5kZXhPZihzZWFyY2hTdHJpbmcpID49IDApKVxyXG5cdFx0cmVjb3JkLm93bmVyID0gb3duZXI7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEp1cmlkaWNhbFBlcnNvbnNSZWFkZXI7XHJcblxyXG52YXIgbSA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxDbGFzc2VzXCIpO1xyXG4iLCJ2YXIgQmFzZUNzdlJlYWRlciA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvcmVhZGVycy9CYXNlQ3N2UmVhZGVyXCIpO1xyXG5cclxuY2xhc3MgT2xkQXBhcnRtZW50TnVtYmVyc1JlYWRlciBleHRlbmRzIEJhc2VDc3ZSZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKG1vZGVsKSB7XHJcblx0XHRzdXBlcih7XHJcblx0XHRcdHNraXBSb3dzOiAxXHJcblx0XHR9KTtcclxuXHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XHJcblx0fVxyXG5cdC8vIEBvdmVycmlkZVxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBjID0gcmVjb3JkLmxlbmd0aDsgaSA8IGM7IGkrKykge1xyXG5cdFx0XHRyZWNvcmRbaV0gPSB1dGlscy5wYXJzZUludChyZWNvcmRbaV0pO1xyXG5cdFx0XHRpZiAocmVjb3JkW2ldID09IG51bGwpXHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0JfQvdCw0YfQtdC90LjRjyDQtNC+0LvQttC90Ysg0LHRi9GC0Ywg0YfQuNGB0LvQvtCy0YvQvNC4XCIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBzZWN0aW9uR2UgPSByZWNvcmRbMF07XHJcblx0XHR2YXIgc2VjdGlvbkxlID0gcmVjb3JkWzFdO1xyXG5cdFx0dmFyIGZsb29yR2UgPSByZWNvcmRbMl07XHJcblx0XHR2YXIgZmxvb3JMZSA9IHJlY29yZFszXTtcclxuXHRcdHZhciBudW1iZXJHZSA9IHJlY29yZFs0XTtcclxuXHRcdHZhciBudW1iZXJMZSA9IHJlY29yZFs1XTtcclxuXHRcdHZhciBkID0gcmVjb3JkWzZdO1xyXG5cclxuXHRcdHZhciBvYmplY3RzID0gdGhpcy5fbW9kZWwub2JqZWN0cztcclxuXHRcdHZhciB1cGRhdGVzID0gMDtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBjID0gb2JqZWN0cy5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdFx0dmFyIG9iaiA9IG9iamVjdHNbaV07XHJcblx0XHRcdGlmIChvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudCAmJlxyXG5cdFx0XHRcdG9iai5zZWN0aW9uID49IHNlY3Rpb25HZSAmJiBvYmouc2VjdGlvbiA8PSBzZWN0aW9uTGUgJiZcclxuXHRcdFx0XHRvYmouZmxvb3IgPj0gZmxvb3JHZSAmJiBvYmouZmxvb3IgPD0gZmxvb3JMZSAmJlxyXG5cdFx0XHRcdG9iai5udW1iZXIgPj0gbnVtYmVyR2UgJiYgb2JqLm51bWJlciA8PSBudW1iZXJMZSlcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG9iai5zZXROdW1iZXIob2JqLm51bWJlciArIGQpO1xyXG5cdFx0XHRcdHVwZGF0ZXMrKztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKHVwZGF0ZXMgPT0gMClcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtSDQvdCw0LnQtNC10L3QviDQvdC4INC+0LTQvdC+0Lkg0L/QvtC00YXQvtC00Y/RidC10Lkg0LfQsNC/0LjRgdC4XCIpO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBPbGRBcGFydG1lbnROdW1iZXJzUmVhZGVyO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlc1wiKTtcclxuIiwidmFyIEJhc2VDc3ZSZWFkZXIgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvQmFzZUNzdlJlYWRlclwiKTtcclxuXHJcbmNsYXNzIE93bmVyc1JlZ2lzdHJ5UmVhZGVyIGV4dGVuZHMgQmFzZUNzdlJlYWRlciB7XHJcblx0Y29uc3RydWN0b3IobW9kZWwpIHtcclxuXHRcdHN1cGVyKHtcclxuXHRcdFx0c2tpcFJvd3M6IDIsXHJcblx0XHR9KTtcclxuXHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XHJcblx0fVxyXG5cdC8vIEBvdmVycmlkZVxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cclxuXHRcdHZhciByZWNvcmROdW1iZXIgPSByZWNvcmRbMF07XHJcblx0XHRpZiAoIXJlY29yZE51bWJlcilcclxuXHRcdFx0Ly8g0L3QtSDQvtCx0YDQsNCx0LDRgtGL0LLQsNC10Lwg0YHRgtGA0L7QutC4INCx0LXQtyDQvdC+0LzQtdGA0LAg0LfQsNC/0LjRgdC4XHJcblx0XHRcdHJldHVybjtcclxuXHRcdHJlY29yZE51bWJlciA9IFBhcnNpbmcucGFyc2VSZWNvcmROdW1iZXIocmVjb3JkTnVtYmVyKTtcclxuXHJcblx0XHR2YXIgbnVtYmVyID0gUGFyc2luZy5wYXJzZU51bWJlcihyZWNvcmRbMV0pO1xyXG5cdFx0dmFyIGxhbmRpbmdOdW1iZXIgPSBQYXJzaW5nLnBhcnNlTGFuZGluZ051bWJlcihyZWNvcmRbMl0pO1xyXG5cdFx0dmFyIGZsb29yID0gUGFyc2luZy5wYXJzZUZsb29yKHJlY29yZFszXSk7XHJcblx0XHR2YXIgYnVpbGRpbmcgPSBQYXJzaW5nLnBhcnNlQnVpbGRpbmcocmVjb3JkWzRdKTtcclxuXHRcdHZhciBzZWN0aW9uID0gUGFyc2luZy5wYXJzZVNlY3Rpb24ocmVjb3JkWzVdKTtcclxuXHRcdHZhciBhcmVhID0gUGFyc2luZy5wYXJzZUFyZWEocmVjb3JkWzZdKTtcclxuXHJcblx0XHR2YXIgb3duZXIgPSByZWNvcmRbN107XHJcblx0XHRpZiAoIW93bmVyKVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLQntGC0YHRg9GC0YHRgtCy0YPQtdGCINCy0LvQsNC00LXQu9C10YY6IFwiICsgcmVjb3JkWzddKTtcclxuXHJcblx0XHR2YXIgbW9kZWxSZWNvcmQgPSBuZXcgbS5Pd25lcnNSZWdpc3RyeVJlY29yZChyZWNvcmROdW1iZXIsIG93bmVyKTtcclxuXHRcdHRoaXMuX21vZGVsLmFkZFJlY29yZChtb2RlbFJlY29yZCk7XHJcblxyXG5cdFx0dmFyIHR5cGUgPSBcItC60LLQsNGA0YLQuNGA0LBcIjtcclxuXHRcdHRoaXMuX21vZGVsLmFkZE9iamVjdChuZXcgbS5BcGFydG1lbnQobW9kZWxSZWNvcmQsIHR5cGUsIG51bWJlciwgYnVpbGRpbmcsIGZsb29yLCBsYW5kaW5nTnVtYmVyLCBzZWN0aW9uLCBhcmVhKSk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE93bmVyc1JlZ2lzdHJ5UmVhZGVyO1xyXG5cclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlcy5qc1wiKTtcclxudmFyIFBhcnNpbmcgPSByZXF1aXJlKFwiYXBwL21vZGVsL3JlYWRlcnMvUGFyc2luZy5qc1wiKTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0cGFyc2VDc3ZGbG9hdCxcclxuXHRwYXJzZVNlY3Rpb24sIHBhcnNlRmxvb3IsIHBhcnNlQnVpbGRpbmcsIHBhcnNlTnVtYmVyLCBwYXJzZUxhbmRpbmdOdW1iZXIsIHBhcnNlUmVjb3JkTnVtYmVyLCBwYXJzZUFyZWEsXHJcbn07XHJcblxyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiYXBwL3V0aWxzXCIpO1xyXG5cclxuZnVuY3Rpb24gcGFyc2VDc3ZGbG9hdCh2YWx1ZSkge1xyXG5cdHZhbHVlID0gdmFsdWUucmVwbGFjZSgvLC9nLCBcIi5cIik7XHJcblx0cmV0dXJuIHV0aWxzLnBhcnNlRmxvYXQodmFsdWUpO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZnVuY3Rpb24gcGFyc2VTZWN0aW9uKHMpIHtcclxuXHR2YXIgdmFsdWUgPSB1dGlscy5wYXJzZUludChzKTtcclxuXHRpZiAodmFsdWUgPT0gbnVsbClcclxuXHRcdHRocm93IG5ldyBFcnJvcihcItCd0LXQutC+0YDRgNC10LrRgtC90YvQuSDQvdC+0LzQtdGAINGB0LXQutGG0LjQuDogXCIgKyBzKTtcclxuXHRyZXR1cm4gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRmxvb3Iocykge1xyXG5cdHZhciB2YWx1ZSA9IHV0aWxzLnBhcnNlSW50KHMpO1xyXG5cdGlmICh2YWx1ZSA9PSBudWxsKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3Ri9C5INC90L7QvNC10YAg0Y3RgtCw0LbQsDogXCIgKyBzKTtcclxuXHRyZXR1cm4gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlQnVpbGRpbmcocykge1xyXG5cdHZhciB2YWx1ZSA9IHV0aWxzLnBhcnNlSW50KHMpO1xyXG5cdGlmICh2YWx1ZSAhPSAxICYmIHZhbHVlICE9IDIpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCLQndC10LrQvtGA0YDQtdC60YLQvdGL0Lkg0L3QvtC80LXRgCDQutC+0YDQv9GD0YHQsDogXCIgKyBzKTtcclxuXHRyZXR1cm4gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlTnVtYmVyKHMpIHtcclxuXHR2YXIgdmFsdWUgPSB1dGlscy5wYXJzZUludChzKTtcclxuXHRpZiAodmFsdWUgPT0gbnVsbClcclxuXHRcdHRocm93IG5ldyBFcnJvcihcItCd0LXQutC+0YDRgNC10LrRgtC90YvQuSDQvdC+0LzQtdGAINC60LLQsNGA0YLQuNGA0Ys6IFwiICsgcyk7XHJcblx0cmV0dXJuIHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUxhbmRpbmdOdW1iZXIocykge1xyXG5cdHZhciB2YWx1ZSA9IHV0aWxzLnBhcnNlSW50KHMpO1xyXG5cdGlmICh2YWx1ZSA9PSBudWxsKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3Ri9C5INC90L7QvNC10YAg0L3QsCDQv9C70L7RidCw0LTQutC1OiBcIiArIHMpO1xyXG5cdHJldHVybiB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VSZWNvcmROdW1iZXIocykge1xyXG5cdHZhciB2YWx1ZSA9IHV0aWxzLnBhcnNlSW50KHMpO1xyXG5cdGlmICh2YWx1ZSA9PSBudWxsKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3Ri9C5INC90L7QvNC10YAg0LfQsNC/0LjRgdC4OiBcIiArIHMpO1xyXG5cdHJldHVybiB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VBcmVhKHMpIHtcclxuXHR2YXIgdmFsdWUgPSBwYXJzZUNzdkZsb2F0KHMpO1xyXG5cdGlmICh2YWx1ZSA9PSBudWxsKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3QvtC1INC30L3QsNGH0LXQvdC40LUg0L/Qu9C+0YnQsNC00Lg6IFwiICsgcyk7XHJcblx0cmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsInZhciBCYXNlQ3N2UmVhZGVyID0gcmVxdWlyZShcImFwcC9tb2RlbC9yZWFkZXJzL0Jhc2VDc3ZSZWFkZXJcIik7XHJcblxyXG5jbGFzcyBQYXJ0aWNpcGFudHNSZWdpc3RyeVJlYWRlciBleHRlbmRzIEJhc2VDc3ZSZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKG1vZGVsKSB7XHJcblx0XHRzdXBlcih7XHJcblx0XHRcdHNraXBSb3dzOiAxLFxyXG5cdFx0fSk7XHJcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xyXG5cdFx0dGhpcy5fcmVjb3JkcyA9IHt9OyAvLyByZWNvcmROdW1iZXIgPT4gX1JlY29yZFxyXG5cdH1cclxuXHRyZWFkKGNzdiwgY2FsbGJhY2spIHtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRzdXBlci5yZWFkKGNzdiwgZnVuY3Rpb24oZXgpIHtcclxuXHRcdFx0aWYgKCFleClcclxuXHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbWUuX3JlY29yZHMpXHJcblx0XHRcdFx0XHRpZiAobWUuX3JlY29yZHMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuXHRcdFx0XHRcdFx0bWUuX3JlY29yZHNba2V5XS5maW5pc2goKTtcclxuXHRcdFx0Y2FsbGJhY2soZXgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdC8vIEBvdmVycmlkZVxyXG5cdF9wcm9jZXNzUmVjb3JkKHJlY29yZCkge1xyXG5cdFx0dmFyIHJlY29yZE51bWJlciA9IHJlY29yZFszXTtcclxuXHRcdGlmICghcmVjb3JkTnVtYmVyKVxyXG5cdFx0XHQvLyDQvdC1INC+0LHRgNCw0LHQsNGC0YvQstCw0LXQvCDRgdGC0YDQvtC60Lgg0LHQtdC3INC90L7QvNC10YDQsCDQt9Cw0L/QuNGB0LhcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0cmVjb3JkTnVtYmVyID0gUGFyc2luZy5wYXJzZVJlY29yZE51bWJlcihyZWNvcmROdW1iZXIpO1xyXG5cclxuXHRcdHZhciBzb3VyY2UgPSByZWNvcmRbMV07XHJcblx0XHRpZiAoIXNvdXJjZSlcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0J7RgtGB0YPRgtCy0YPQtdGCINGB0YLRgNC+0LrQsCDQt9Cw0L/QuNGB0LhcIik7XHJcblx0XHR2YXIgX3JlY29yZDtcclxuXHRcdHZhciBtb2RlbFJlY29yZDtcclxuXHRcdGlmICghKHJlY29yZE51bWJlciBpbiB0aGlzLl9yZWNvcmRzKSkge1xyXG5cdFx0XHRfcmVjb3JkID0gdGhpcy5fcmVjb3Jkc1tyZWNvcmROdW1iZXJdID0gbmV3IF9SZWNvcmQocmVjb3JkTnVtYmVyKTtcclxuXHRcdFx0bW9kZWxSZWNvcmQgPSBfcmVjb3JkLm1vZGVsUmVjb3JkKCk7XHJcblx0XHRcdHRoaXMuX21vZGVsLmFkZFJlY29yZChtb2RlbFJlY29yZCk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0X3JlY29yZCA9IHRoaXMuX3JlY29yZHNbcmVjb3JkTnVtYmVyXTtcclxuXHRcdFx0bW9kZWxSZWNvcmQgPSBfcmVjb3JkLm1vZGVsUmVjb3JkKCk7XHJcblx0XHR9XHJcblx0XHRfcmVjb3JkLmFwcGVuZFNvdXJjZShzb3VyY2UpO1xyXG5cclxuXHRcdHZhciB0eXBlID0gcmVjb3JkWzRdO1xyXG5cdFx0aWYgKCF0eXBlKSB7XHJcblx0XHRcdC8vINGB0YLRgNC+0LrQsCDQsdC10Lcg0L7QsdGK0LXQutGC0LBcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDU7IGkgPCByZWNvcmQubGVuZ3RoOyBpKyspXHJcblx0XHRcdFx0aWYgKHJlY29yZFtpXSlcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihcItCh0YLRgNC+0LrQsCwg0L3QtSDRgdC+0LTQtdGA0LbQsNGJ0LDRjyDRgtC40L8g0L7QsdGK0LXQutGC0LAsINC90LUg0LTQvtC70LbQvdCwINGB0L7QtNC10YDQttCw0YLRjCDQuNC90YTQvtGA0LzQsNGG0LjQuCDQvtCxINC+0LHRitC10LrRgtC1XCIpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG51bWJlciA9IHJlY29yZFs1XTtcclxuXHRcdC8vINC90L7QvNC10YAg0L7QsdGK0LXQutGC0LAg0L7Qv9GG0LjQvtC90LDQu9GM0L3Ri9C5INC00LvRjyDQvdC10LbQuNC70YvRhSDQv9C+0LzQtdGJ0LXQvdC40LlcclxuXHRcdG51bWJlciA9ICFudW1iZXIgfHwgbnVtYmVyID09IFwi0LHQvVwiID8gbnVsbCA6IFBhcnNpbmcucGFyc2VOdW1iZXIobnVtYmVyKTtcclxuXHJcblx0XHR2YXIgYnVpbGRpbmcgPSBQYXJzaW5nLnBhcnNlQnVpbGRpbmcocmVjb3JkWzZdKTtcclxuXHRcdHZhciBhcmVhID0gUGFyc2luZy5wYXJzZUFyZWEocmVjb3JkWzldKTtcclxuXHJcblx0XHRpZiAodHlwZSA9PSBcItC80LDRiNC40L3QvtC80LXRgdGC0L5cIikge1xyXG5cdFx0XHRpZiAobnVtYmVyID09IG51bGwpXHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3Ri9C5INC90L7QvNC10YAg0L7QsdGK0LXQutGC0LA6IFwiICsgcmVjb3JkWzVdKTtcclxuXHRcdFx0dGhpcy5fbW9kZWwuYWRkT2JqZWN0KG5ldyBtLlBhcmtpbmdQbGFjZShtb2RlbFJlY29yZCwgbnVtYmVyLCBidWlsZGluZywgYXJlYSkpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHNlY3Rpb24gPSByZWNvcmRbOF07XHJcblx0XHQvLyDQvdC+0LzQtdGAINGB0LXQutGG0LjQuCDQvtC/0YbQuNC+0L3QsNC70YzQvdGL0LlcclxuXHRcdHNlY3Rpb24gPSAhc2VjdGlvbiB8fCBzZWN0aW9uID09IFwi0L3QtdGCXCIgfHwgc2VjdGlvbiA9PSBcIj9cIiA/IG51bGwgOiBQYXJzaW5nLnBhcnNlU2VjdGlvbihzZWN0aW9uKTtcclxuXHJcblx0XHRpZiAodHlwZSA9PSBcItC90LXQtiDQv9C+0LxcIiB8fCB0eXBlLnNlYXJjaCgv0L/RgNC10LTQv9GA0LjRj9GC0LjQtS9pKSA+PSAwIHx8IHR5cGUgPT0gXCLQvNCw0LPQsNC30LjQvVwiIHx8IHR5cGUgPT0gXCLQvtGE0LjRgVwiKSB7XHJcblx0XHRcdHRoaXMuX21vZGVsLmFkZE9iamVjdChuZXcgbS5Ob25SZXNpZGVudGlhbFByZW1pc2UobW9kZWxSZWNvcmQsIHR5cGUsIG51bWJlciwgYnVpbGRpbmcsIHNlY3Rpb24sIGFyZWEpKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBmbG9vciA9IFBhcnNpbmcucGFyc2VGbG9vcihyZWNvcmRbN10pO1xyXG5cclxuXHRcdGlmIChudW1iZXIgPT0gbnVsbClcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC60L7RgNGA0LXQutGC0L3Ri9C5INC90L7QvNC10YAg0L7QsdGK0LXQutGC0LA6IFwiICsgcmVjb3JkWzVdKTtcclxuXHJcblx0XHR2YXIgbGFuZGluZ051bWJlciA9IG51bGw7XHJcblx0XHR0aGlzLl9tb2RlbC5hZGRPYmplY3QobmV3IG0uQXBhcnRtZW50KG1vZGVsUmVjb3JkLCB0eXBlLCBudW1iZXIsIGJ1aWxkaW5nLCBmbG9vciwgbGFuZGluZ051bWJlciwgc2VjdGlvbiwgYXJlYSkpO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQYXJ0aWNpcGFudHNSZWdpc3RyeVJlYWRlcjtcclxuXHJcbnZhciB1dGlscyA9IHJlcXVpcmUoXCJhcHAvdXRpbHNcIik7XHJcbnZhciBtID0gcmVxdWlyZShcImFwcC9tb2RlbC9Nb2RlbENsYXNzZXMuanNcIik7XHJcbnZhciBQYXJzaW5nID0gcmVxdWlyZShcImFwcC9tb2RlbC9yZWFkZXJzL1BhcnNpbmcuanNcIik7XHJcblxyXG5jbGFzcyBfUmVjb3JkIHtcclxuXHRjb25zdHJ1Y3RvcihyZWNvcmROdW1iZXIpIHtcclxuXHRcdHRoaXMuX3NvdXJjZSA9IFtdO1xyXG5cdFx0dGhpcy5fbW9kZWxSZWNvcmQgPSBuZXcgbS5QYXJ0aWNpcGFudHNSZWdpc3RyeVJlY29yZChyZWNvcmROdW1iZXIsIG51bGwsIG51bGwsIG51bGwpO1xyXG5cdH1cclxuXHRtb2RlbFJlY29yZCgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9tb2RlbFJlY29yZDtcclxuXHR9XHJcblx0YXBwZW5kU291cmNlKHNvdXJjZSkge1xyXG5cdFx0dGhpcy5fc291cmNlLnB1c2goc291cmNlKTtcclxuXHR9XHJcblx0ZmluaXNoKCkge1xyXG5cdFx0dmFyIHNvdXJjZSA9IHRoaXMuX3NvdXJjZS5qb2luKFwiXFxuXCIpO1xyXG5cdFx0dmFyIHJlZ2lzdHJ5SW5mbyA9IGV4dHJhY3RSZWdpc3RyeUluZm8oc291cmNlKTtcclxuXHRcdHRoaXMuX21vZGVsUmVjb3JkLnJlZ2lzdHJ5TnVtYmVyID0gcmVnaXN0cnlJbmZvLm51bWJlcjtcclxuXHRcdHRoaXMuX21vZGVsUmVjb3JkLmRhdGUgPSByZWdpc3RyeUluZm8uZGF0ZTtcclxuXHRcdHRoaXMuX21vZGVsUmVjb3JkLnNvdXJjZSA9IHNvdXJjZTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RSZWdpc3RyeUluZm8oc291cmNlKSB7XHJcblx0dmFyIG0gPSBzb3VyY2UubWF0Y2goL+KEllxccyooLio/KVxccyvQvtGCXFxzKyhcXGQrKVxcLihcXGQrKVxcLihcXGQrKS8pO1xyXG5cdGlmICghbSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihcItCSINC30LDQv9C40YHQuCDQvdC1INC90LDQudC00LXQvdGLINGA0LXQs9C40YHRgtGA0LDRhtC40L7QvdC90YvQuSDQvdC+0LzQtdGAINC4INC00LDRgtCwINGA0LXQs9C40YHRgtGA0LDRhtC40LhcIik7XHJcblxyXG5cdHZhciBudW1iZXIgPSBtWzFdO1xyXG5cclxuXHR2YXIgZGF5ID0gdXRpbHMucGFyc2VJbnQobVsyXSk7XHJcblx0dmFyIG1vbnRoID0gdXRpbHMucGFyc2VJbnQobVszXSk7XHJcblx0dmFyIHllYXIgPSB1dGlscy5wYXJzZUludChtWzRdKTtcclxuXHR2YXIgZGF0ZSA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLTEsIGRheSk7XHJcblxyXG5cdHJldHVybiB7IG51bWJlciwgZGF0ZSB9O1xyXG59XHJcbiIsInJlcXVpcmUoXCJmdW5jdGlvbi5uYW1lLXBvbHlmaWxsXCIpO1xyXG5cclxuaWYgKCFTdHJpbmcucHJvdG90eXBlLnN0YXJ0c1dpdGgpIHtcclxuXHRTdHJpbmcucHJvdG90eXBlLnN0YXJ0c1dpdGggPSBmdW5jdGlvbihvdGhlcikgeyByZXR1cm4gdGhpcy5zdWJzdHJpbmcoMCwgb3RoZXIubGVuZ3RoKSA9PT0gb3RoZXI7IH07XHJcblx0U3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCA9IGZ1bmN0aW9uKG90aGVyKSB7IHJldHVybiB0aGlzLnN1YnN0cmluZyh0aGlzLmxlbmd0aCAtIG90aGVyLmxlbmd0aCkgPT09IG90aGVyOyB9O1xyXG59XHJcbiIsIi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gSlNcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZnVuY3Rpb24gcGFyc2VJbnQodmFsdWUpIHtcclxuXHR2YWx1ZSA9IHdpbmRvdy5wYXJzZUludCh2YWx1ZSwgMTApO1xyXG5cdHJldHVybiBpc05hTih2YWx1ZSkgPyBudWxsIDogdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRmxvYXQodmFsdWUpIHtcclxuXHR2YWx1ZSA9IHdpbmRvdy5wYXJzZUZsb2F0KHZhbHVlKTtcclxuXHRyZXR1cm4gaXNOYU4odmFsdWUpID8gbnVsbCA6IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZURhdGUodmFsdWUpIHtcclxuXHR2YXIgZGF0ZSA9IG5ldyBEYXRlKHZhbHVlKTtcclxuXHRyZXR1cm4gaXNOYU4oZGF0ZS5nZXRUaW1lKCkpID8gbnVsbCA6IGRhdGU7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gQXJyYXlzXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbnZhciBBcnJheXMgPSB7XHJcblxyXG5cdGNsb25lOiBmdW5jdGlvbihhKSB7XHJcblx0XHRyZXR1cm4gYS5zbGljZSgwKTtcclxuXHR9LFxyXG5cclxuXHRmaW5kRmlyc3RJbmRleDogZnVuY3Rpb24oYSwgdmFsdWUpIHtcclxuXHRcdHJldHVybiBhLmluZGV4T2YodmFsdWUpO1xyXG5cdH0sXHJcblxyXG5cdC8vIHJlbW92ZSBmaXJzdCB2YWx1ZSA9PT0gZ2l2ZW5cclxuXHRyZW1vdmVGaXJzdDogZnVuY3Rpb24oYSwgdmFsdWUpIHtcclxuXHRcdHZhciBwb3MgPSB0aGlzLmZpbmRGaXJzdEluZGV4KGEsIHZhbHVlKTtcclxuXHRcdGlmIChwb3MgPj0gMCkge1xyXG5cdFx0XHRhLnNwbGljZShwb3MsIDEpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9LFxyXG59O1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBTdHJpbmdzXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmZ1bmN0aW9uIGN1dFN0cmluZyhzLCBtYXhMZW5ndGgsIGVsbGlwc2lzIC8qID0gXCIuLi5cIiAqLykge1xyXG5cdGlmIChlbGxpcHNpcyA9PT0gdW5kZWZpbmVkKVxyXG5cdFx0ZWxsaXBzaXMgPSBcIi4uLlwiO1xyXG5cdHJldHVybiBzLmxlbmd0aCA8PSBtYXhMZW5ndGggPyBzIDogcy5zdWJzdHJpbmcoMCwgbWF4TGVuZ3RoKSArIGVsbGlwc2lzO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIEhUTUxcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZnVuY3Rpb24gaHRtbEVuY29kZShzKSB7XHJcblx0cmV0dXJuIHMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIERPTVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVGcm9tSHRtbChodG1sKSB7XHJcblx0dmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0ZGl2LmlubmVySFRNTCA9IGh0bWw7XHJcblx0aWYgKGRpdi5jaGlsZHJlbi5sZW5ndGggIT0gMSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkZhaWxlZCB0byBjcmVhdGUgRE9NIGVsZW1lbnQgZnJvbSBIVE1MOiBcIiArIGN1dFN0cmluZyhodG1sLCAyMCkpO1xyXG5cdHJldHVybiBkaXYuZmlyc3RFbGVtZW50Q2hpbGQ7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gTDE4TlxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vLyBodHRwOi8vdHJhbnNsYXRlLnNvdXJjZWZvcmdlLm5ldC93aWtpL2wxMG4vcGx1cmFsZm9ybXNcclxuZnVuY3Rpb24gcGx1cmFsKG4sIC8qIG9wdGlvbmFsICovIGEpIHtcclxuXHRuID0gKG4gJSAxMCA9PSAxICYmIG4gJSAxMDAgIT0gMTEgPyAwIDogbiAlIDEwID49IDIgJiYgbiAlIDEwIDw9IDQgJiYgKG4gJSAxMDAgPCAxMCB8fCBuICUgMTAwID49IDIwKSA/IDEgOiAyKTtcclxuXHRyZXR1cm4gYSA9PT0gdW5kZWZpbmVkID8gbiA6IGFbbl07XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gRGVsZWdhdGVcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuY2xhc3MgRGVsZWdhdGUge1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0dGhpcy5oYW5kbGVycyA9IFtdO1xyXG5cdFx0dGhpcy5fbXV0ZSA9IDA7XHJcblx0fVxyXG5cdGJpbmQoaGFuZGxlciwgLyogb3B0aW9uYWwgKi8gY29udGV4dCkge1xyXG5cdFx0aWYgKGhhbmRsZXIgPT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKFwiQXJndW1lbnQgaXMgbnVsbDogaGFuZGxlclwiKTtcclxuXHRcdHRoaXMuaGFuZGxlcnMucHVzaCh7IGhhbmRsZXI6IGhhbmRsZXIsIGNvbnRleHQ6IGNvbnRleHQgfSk7XHJcblx0fVxyXG5cdHVuYmluZChoYW5kbGVyLCAvKiBvcHRpb25hbCAqLyBjb250ZXh0KSB7XHJcblx0XHRpZiAoaGFuZGxlciA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBpcyBudWxsOiBoYW5kbGVyXCIpO1xyXG5cdFx0dmFyIGxlbiA9IHRoaXMuaGFuZGxlcnMubGVuZ3RoO1xyXG5cdFx0dGhpcy5oYW5kbGVycyA9IHRoaXMuaGFuZGxlcnMuZmlsdGVyKGggPT4gIShoLmhhbmRsZXIgPT09IGhhbmRsZXIgJiYgKGNvbnRleHQgPT09IHVuZGVmaW5lZCB8fCBoLmNvbnRleHQgPT09IGNvbnRleHQpKSk7XHJcblx0XHRpZiAodGhpcy5oYW5kbGVycy5sZW5ndGggPT0gbGVuKVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJIYW5kbGVyIHRvIHVuYmluZCB3YXMgbm90IGZvdW5kXCIpO1xyXG5cdH1cclxuXHR0cmlnZ2VyKC8qIG9wdGlvbmFsICovIGRhdGEpIHtcclxuXHRcdGlmICh0aGlzLl9tdXRlID4gMCkgcmV0dXJuO1xyXG5cdFx0aWYgKGRhdGEgPT09IHVuZGVmaW5lZCkgZGF0YSA9IHt9O1xyXG5cdFx0dmFyIGhhbmRsZXJzID0gQXJyYXlzLmNsb25lKHRoaXMuaGFuZGxlcnMpO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGMgPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdFx0dmFyIGggPSBoYW5kbGVyc1tpXTtcclxuXHRcdFx0aC5oYW5kbGVyLmNhbGwoaC5jb250ZXh0LCBkYXRhKTtcclxuXHRcdH1cclxuXHR9XHJcblx0bXV0ZShpbmMgLyogPSAxICovKSB7XHJcblx0XHRpZiAoaW5jID09PSB1bmRlZmluZWQpIGluYyA9IDE7XHJcblx0XHR0aGlzLl9tdXRlICs9IGluYztcclxuXHR9XHJcblx0Z2V0TGVuZ3RoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaGFuZGxlcnMubGVuZ3RoO1xyXG5cdH1cclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0Ly8gSlNcclxuXHRwYXJzZUludCwgcGFyc2VGbG9hdCwgcGFyc2VEYXRlLFxyXG5cdC8vIEFycmF5c1xyXG5cdEFycmF5cyxcclxuXHQvLyBTdHJpbmdzXHJcblx0Y3V0U3RyaW5nLFxyXG5cdC8vIEhUTUxcclxuXHRodG1sRW5jb2RlLFxyXG5cdC8vIERPTVxyXG5cdGNyZWF0ZUZyb21IdG1sLFxyXG5cdC8vIEwxOE5cclxuXHRwbHVyYWwsXHJcblx0Ly8gRGVsZWdhdGVcclxuXHREZWxlZ2F0ZSxcclxufTtcclxuIiwidmFyIFZpZXcgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1ZpZXdcIik7XHJcblxyXG5jbGFzcyBEYXRhVmlldyBleHRlbmRzIFZpZXcge1xyXG5cdGNvbnN0cnVjdG9yKGxvYWRDb250cm9sbGVyKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRtZS5fbG9hZENvbnRyb2xsZXIgPSBsb2FkQ29udHJvbGxlcjtcclxuXHJcblx0XHRsb2FkQ29udHJvbGxlci5vbk9wZXJhdGlvblN0YXJ0LmJpbmQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdG1lLl9jbGVhclJlcG9ydCgpO1xyXG5cdFx0fSk7XHJcblx0XHRsb2FkQ29udHJvbGxlci5vbk9wZXJhdGlvbkVuZC5iaW5kKGZ1bmN0aW9uKC8qIG9wdGlvbmFsICovIGV4KSB7XHJcblx0XHRcdGlmIChleCkgbWUuX3JlcG9ydEVycm9yKGV4KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0SHRtbCgpIHtcclxuXHRcdHJldHVybiBgXHJcblx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkfVwiIGNsYXNzPVwiZGF0YXZpZXdcIj5cclxuXHRcdFx0XHQ8ZGl2IGlkPVwiJHt0aGlzLnVpZCArIFwiX21lc3NhZ2VzXCJ9XCI+PC9kaXY+XHJcblx0XHRcdFx00JjRgdC/0L7Qu9GM0LfRg9GO0YLRgdGPINGB0LvQtdC00YPRjtGJ0LjQtSDQtNCw0L3QvdGL0LU6XHJcblx0XHRcdFx0PHVsIGNsYXNzPVwiZGF0YXZpZXdfc291cmNlc1wiPlxyXG5cdFx0XHRcdFx0PGxpPiR7cmVuZGVyTGluayh0aGlzLl9sb2FkQ29udHJvbGxlci5wYXJ0aWNpcGFudHNSZWdpc3RyeVVybCl9PC9saT5cclxuXHRcdFx0XHRcdDxsaT4ke3JlbmRlckxpbmsodGhpcy5fbG9hZENvbnRyb2xsZXIub3duZXJzUmVnaXN0cnlVcmwpfTwvbGk+XHJcblx0XHRcdFx0XHQ8bGk+XHJcblx0XHRcdFx0XHRcdCR7cmVuZGVyTGluayh0aGlzLl9sb2FkQ29udHJvbGxlci5hcGFydG1lbnRzV2l0aG91dFNlY3Rpb25VcmwpfVxyXG5cdFx0XHRcdFx0XHQ8bGFiZWw+0JfQsNCz0YDRg9C30LjRgtGMINGB0LLQvtC5INGE0LDQudC7OiA8aW5wdXQgdHlwZT1cImZpbGVcIiBpZD1cIiR7dGhpcy51aWQgKyBcIl9hcGFydG1lbnRzV2l0aG91dFNlY3Rpb25cIn1cIj48L2xhYmVsPlxyXG5cdFx0XHRcdFx0PC9saT5cclxuXHRcdFx0XHRcdDxsaT5cclxuXHRcdFx0XHRcdFx0JHtyZW5kZXJMaW5rKHRoaXMuX2xvYWRDb250cm9sbGVyLmluY29ycmVjdEFwYXJ0bWVudHNVcmwpfVxyXG5cdFx0XHRcdFx0XHQ8bGFiZWw+0JfQsNCz0YDRg9C30LjRgtGMINGB0LLQvtC5INGE0LDQudC7OiA8aW5wdXQgdHlwZT1cImZpbGVcIiBpZD1cIiR7dGhpcy51aWQgKyBcIl9pbmNvcnJlY3RBcGFydG1lbnRzXCJ9XCI+PC9sYWJlbD5cclxuXHRcdFx0XHRcdDwvbGk+XHJcblx0XHRcdFx0XHQ8bGk+XHJcblx0XHRcdFx0XHRcdCR7cmVuZGVyTGluayh0aGlzLl9sb2FkQ29udHJvbGxlci5vbGRBcGFydG1lbnROdW1iZXJzVXJsKX1cclxuXHRcdFx0XHRcdFx0PGxhYmVsPtCX0LDQs9GA0YPQt9C40YLRjCDRgdCy0L7QuSDRhNCw0LnQuzogPGlucHV0IHR5cGU9XCJmaWxlXCIgaWQ9XCIke3RoaXMudWlkICsgXCJfb2xkQXBhcnRtZW50TnVtYmVyc1wifVwiPjwvbGFiZWw+XHJcblx0XHRcdFx0XHQ8L2xpPlxyXG5cdFx0XHRcdFx0PGxpPlxyXG5cdFx0XHRcdFx0XHQke3JlbmRlckxpbmsodGhpcy5fbG9hZENvbnRyb2xsZXIuanVyaWRpY2FsUGVyc29uc1VybCl9XHJcblx0XHRcdFx0XHRcdDxsYWJlbD7Ql9Cw0LPRgNGD0LfQuNGC0Ywg0YHQstC+0Lkg0YTQsNC50Ls6IDxpbnB1dCB0eXBlPVwiZmlsZVwiIGlkPVwiJHt0aGlzLnVpZCArIFwiX2p1cmlkaWNhbFBlcnNvbnNcIn1cIj48L2xhYmVsPlxyXG5cdFx0XHRcdFx0PC9saT5cclxuXHRcdFx0XHQ8L3VsPlxyXG5cdFx0XHRcdDxidXR0b24gaWQ9XCIke3RoaXMudWlkICsgXCJfcmVmcmVzaFwifVwiPtCe0LHQvdC+0LLQuNGC0Yw8L2J1dHRvbj5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHRgO1xyXG5cdH1cclxuXHRvbkluc3RhbGxlZCgpIHtcclxuXHRcdHN1cGVyLm9uSW5zdGFsbGVkKC4uLmFyZ3VtZW50cyk7XHJcblxyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHZhciAkZWwgPSBtZS4kZWxlbWVudCgpO1xyXG5cclxuXHRcdCRlbC5maW5kKFwiI1wiICsgdGhpcy51aWQgKyBcIl9hcGFydG1lbnRzV2l0aG91dFNlY3Rpb25cIikuY2hhbmdlKGZ1bmN0aW9uKGV2KSB7XHJcblx0XHRcdHZhciBmaWxlID0gZXYudGFyZ2V0LmZpbGVzWzBdO1xyXG5cdFx0XHRmaWxlXHJcblx0XHRcdFx0PyBtZS5fbG9hZENvbnRyb2xsZXIubG9hZEFwYXJ0bWVudHNXaXRob3V0U2VjdGlvbihmaWxlKVxyXG5cdFx0XHRcdDogbWUuX2xvYWRDb250cm9sbGVyLmxvYWREZWZhdWx0QXBhcnRtZW50c1dpdGhvdXRTZWN0aW9uKCk7XHJcblx0XHR9KTtcclxuXHRcdCRlbC5maW5kKFwiI1wiICsgdGhpcy51aWQgKyBcIl9pbmNvcnJlY3RBcGFydG1lbnRzXCIpLmNoYW5nZShmdW5jdGlvbihldikge1xyXG5cdFx0XHR2YXIgZmlsZSA9IGV2LnRhcmdldC5maWxlc1swXTtcclxuXHRcdFx0ZmlsZVxyXG5cdFx0XHRcdD8gbWUuX2xvYWRDb250cm9sbGVyLmxvYWRJbmNvcnJlY3RBcGFydG1lbnRzKGZpbGUpXHJcblx0XHRcdFx0OiBtZS5fbG9hZENvbnRyb2xsZXIubG9hZERlZmF1bHRJbmNvcnJlY3RBcGFydG1lbnRzKCk7XHJcblx0XHR9KTtcclxuXHRcdCRlbC5maW5kKFwiI1wiICsgdGhpcy5fdWlkICsgXCJfb2xkQXBhcnRtZW50TnVtYmVyc1wiKS5jaGFuZ2UoZnVuY3Rpb24oZXYpIHtcclxuXHRcdFx0dmFyIGZpbGUgPSBldi50YXJnZXQuZmlsZXNbMF07XHJcblx0XHRcdGZpbGVcclxuXHRcdFx0XHQ/IG1lLl9sb2FkQ29udHJvbGxlci5sb2FkT2xkQXBhcnRtZW50TnVtYmVycyhmaWxlKVxyXG5cdFx0XHRcdDogbWUuX2xvYWRDb250cm9sbGVyLmxvYWREZWZhdWx0T2xkQXBhcnRtZW50TnVtYmVycygpO1xyXG5cdFx0fSk7XHJcblx0XHQkZWwuZmluZChcIiNcIiArIHRoaXMuX3VpZCArIFwiX2p1cmlkaWNhbFBlcnNvbnNcIikuY2hhbmdlKGZ1bmN0aW9uKGV2KSB7XHJcblx0XHRcdHZhciBmaWxlID0gZXYudGFyZ2V0LmZpbGVzWzBdO1xyXG5cdFx0XHRmaWxlXHJcblx0XHRcdFx0PyBtZS5fbG9hZENvbnRyb2xsZXIubG9hZEp1cmlkaWNhbFBlcnNvbnMoZmlsZSlcclxuXHRcdFx0XHQ6IG1lLl9sb2FkQ29udHJvbGxlci5sb2FkRGVmYXVsdEp1cmlkaWNhbFBlcnNvbnMoKTtcclxuXHRcdH0pO1xyXG5cdFx0JGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3JlZnJlc2hcIikuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRcdG1lLl9yZWZyZXNoKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0X3JlZnJlc2goKSB7XHJcblx0XHR0aGlzLl9sb2FkQ29udHJvbGxlci51cGRhdGVNb2RlbCgpO1xyXG5cdH1cclxuXHJcblx0X2NsZWFyUmVwb3J0KCkge1xyXG5cdFx0dGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX21lc3NhZ2VzXCIpLmh0bWwoXCJcIik7XHJcblx0fVxyXG5cdF9yZXBvcnRFcnJvcihleCkge1xyXG5cdFx0dGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX21lc3NhZ2VzXCIpLnRleHQoZXgubWVzc2FnZSk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFWaWV3O1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxuXHJcbmZ1bmN0aW9uIHJlbmRlckxpbmsodXJsKSB7XHJcblx0dmFyIGZpbGVuYW1lID0gdXJsLnN1YnN0cmluZyh1cmwubGFzdEluZGV4T2YoXCIvXCIpICsgMSk7XHJcblx0cmV0dXJuIGA8YSBocmVmPVwiJHt1cmx9XCIgdGFyZ2V0PVwiX2JsYW5rXCI+JHt1dGlscy5odG1sRW5jb2RlKGZpbGVuYW1lKX08L2E+YDtcclxufVxyXG4iLCLvu792YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIEdyaWQgZXh0ZW5kcyBWaWV3IHtcclxuXHRjb25zdHJ1Y3Rvcihtb2RlbCwgc2VhcmNoTW9kZWwsIHJlY29yZFNlbGVjdGlvbk1vZGVsKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHJcblx0XHRtZS5vYmplY3RQb3B1cCA9IG1lLmFkZENoaWxkKG5ldyBPYmplY3RQb3B1cCgpKTtcclxuXHJcblx0XHRtZS5fbW9kZWwgPSBtb2RlbDtcclxuXHRcdG1lLl9zZWFyY2hNb2RlbCA9IHNlYXJjaE1vZGVsO1xyXG5cdFx0bWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsID0gcmVjb3JkU2VsZWN0aW9uTW9kZWw7XHJcblxyXG5cdFx0bWUuX3NlYXJjaE1vZGVsLm9uQ2hhbmdlZC5iaW5kKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRtZS5fc2hvd1NlYXJjaFJlc3VsdHMoKTtcclxuXHRcdH0pO1xyXG5cdFx0bWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsLm9uQ2hhbmdlZC5iaW5kKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRtZS5fc2hvd1NlbGVjdGVkUmVjb3JkKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0Z2V0SHRtbCgpIHtcclxuXHRcdHJldHVybiBgXHJcblx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkfVwiIGNsYXNzPVwiZ3JpZFwiPlxyXG5cdFx0XHRcdCR7dGhpcy5vYmplY3RQb3B1cC5nZXRIdG1sKCl9XHJcblx0XHRcdFx0PGRpdiBjbGFzcz1cImdyaWRfY29udGVudFwiPjwvZGl2PlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdGA7XHJcblx0fVxyXG5cdG9uSW5zdGFsbGVkKCkge1xyXG5cdFx0c3VwZXIub25JbnN0YWxsZWQoLi4uYXJndW1lbnRzKTtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRtZS4kZWxlbWVudCgpLmNsaWNrKGZ1bmN0aW9uKGV2KSB7XHJcblx0XHRcdHZhciAkdCA9ICQoZXYudGFyZ2V0KTtcclxuXHRcdFx0dmFyICRlID0gJHQuY2xvc2VzdChcIi5ncmlkX29iamVjdFwiKTtcclxuXHRcdFx0aWYgKCRlLmxlbmd0aCkge1xyXG5cdFx0XHRcdHZhciBpZCA9ICRlWzBdLmlkO1xyXG5cdFx0XHRcdHZhciBwcmVmaXggPSBtZS51aWQgKyBcIl9vYmotXCI7XHJcblx0XHRcdFx0aWYgKGlkICYmIGlkLnN0YXJ0c1dpdGgocHJlZml4KSkge1xyXG5cdFx0XHRcdFx0aWQgPSBpZC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XHJcblx0XHRcdFx0XHRtZS5fc2VsZWN0T2JqZWN0KGlkLCBldik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblx0cmVkcmF3KCkge1xyXG5cdFx0dGhpcy5vYmplY3RQb3B1cC5oaWRlKCk7XHJcblxyXG5cdFx0dmFyIGFjYyA9IFtdO1xyXG5cdFx0cmVuZGVyKHRoaXMudWlkLCB0aGlzLl9tb2RlbC5vYmplY3RzLCB0aGlzLl9zZWFyY2hNb2RlbC5nZXRPYmplY3RJZHMoKSwgYWNjKTtcclxuXHRcdHRoaXMuJGVsZW1lbnQoKS5jaGlsZHJlbihcIi5ncmlkX2NvbnRlbnRcIikuaHRtbChhY2Muam9pbihcIlwiKSk7XHJcblx0fVxyXG5cdF9zaG93U2VhcmNoUmVzdWx0cygpIHtcclxuXHRcdHZhciAkZWwgPSB0aGlzLiRlbGVtZW50KCk7XHJcblx0XHRpZiAoISRlbC5sZW5ndGgpXHJcblx0XHRcdHJldHVybjtcclxuXHRcdCRlbC5maW5kKFwiLmdyaWRfb2JqZWN0X19zZWFyY2hcIikucmVtb3ZlQ2xhc3MoXCJncmlkX29iamVjdF9fc2VhcmNoXCIpO1xyXG5cdFx0dmFyIGlkcyA9IHRoaXMuX3NlYXJjaE1vZGVsLmdldE9iamVjdElkcygpO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGMgPSBpZHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHRcdHZhciBpZCA9IGlkc1tpXTtcclxuXHRcdFx0JGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX29iai1cIiArIGlkKS5hZGRDbGFzcyhcImdyaWRfb2JqZWN0X19zZWFyY2hcIik7XHJcblx0XHR9XHJcblx0fVxyXG5cdF9zaG93U2VsZWN0ZWRSZWNvcmQoKSB7XHJcblx0XHR2YXIgJGVsID0gdGhpcy4kZWxlbWVudCgpO1xyXG5cdFx0aWYgKCEkZWwubGVuZ3RoKVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHQkZWwuZmluZChcIi5ncmlkX29iamVjdF9fc2VsZWN0ZWRSZWNvcmRcIikucmVtb3ZlQ2xhc3MoXCJncmlkX29iamVjdF9fc2VsZWN0ZWRSZWNvcmRcIik7XHJcblx0XHR2YXIgcmVjb3JkID0gdGhpcy5fcmVjb3JkU2VsZWN0aW9uTW9kZWwuZ2V0UmVjb3JkKCk7XHJcblx0XHRpZiAocmVjb3JkKVxyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGMgPSByZWNvcmQub2JqZWN0cy5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdFx0dmFyIG9iaiA9IHJlY29yZC5vYmplY3RzW2ldO1xyXG5cdFx0XHQkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfb2JqLVwiICsgb2JqLmlkKS5hZGRDbGFzcyhcImdyaWRfb2JqZWN0X19zZWxlY3RlZFJlY29yZFwiKTtcclxuXHRcdH1cclxuXHR9XHJcblx0X3NlbGVjdE9iamVjdChvYmplY3RJZCwgZXYpIHtcclxuXHRcdHZhciBvYmplY3QgPSB0aGlzLl9tb2RlbC5nZXRPYmplY3RCeUlkKG9iamVjdElkKTtcclxuXHRcdGlmICghb2JqZWN0KSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5fcmVjb3JkU2VsZWN0aW9uTW9kZWwuc2V0UmVjb3JkKG9iamVjdC5yZWNvcmQpO1xyXG5cclxuXHRcdHRoaXMub2JqZWN0UG9wdXAuc2V0T2JqZWN0KG9iamVjdCk7XHJcblx0XHR0aGlzLm9iamVjdFBvcHVwLnNob3coZXYpO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxudmFyIE9iamVjdFBvcHVwID0gcmVxdWlyZShcImFwcC92aWV3cy9PYmplY3RQb3B1cFwiKTtcclxudmFyIEdyaWRWaWV3ID0gcmVxdWlyZShcImFwcC92aWV3cy9HcmlkVmlld1wiKTtcclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlc1wiKTtcclxudmFyIHMgPSByZXF1aXJlKFwiYXBwL1N0cmluZ3NcIik7XHJcblxyXG5mdW5jdGlvbiByZW5kZXIoZ3JpZFVpZCwgb2JqZWN0cywgc2VhcmNoUmVzdWx0cywgYWNjKSB7XHJcblx0b2JqZWN0cy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdChHcmlkVmlldy5pc1N1cHBvcnRlZE9iamVjdChhKSAtIEdyaWRWaWV3LmlzU3VwcG9ydGVkT2JqZWN0KGIpKSB8fFxyXG5cdFx0XHQoYS5idWlsZGluZyAtIGIuYnVpbGRpbmcpIHx8XHJcblx0XHRcdCgoYS5zZWN0aW9uID09IG51bGwpIC0gKGIuc2VjdGlvbiA9PSBudWxsKSkgfHxcclxuXHRcdFx0KGEuc2VjdGlvbiAtIGIuc2VjdGlvbikgfHxcclxuXHRcdFx0KChhLmZsb29yID09IG51bGwpIC0gKGIuZmxvb3IgPT0gbnVsbCkpIHx8XHJcblx0XHRcdChiLmZsb29yIC0gYS5mbG9vcikgfHxcclxuXHRcdFx0KGEubnVtYmVyIC0gYi5udW1iZXIpIHx8XHJcblx0XHRcdCgoYS5yZWNvcmQuZGF0ZSAhPSBudWxsKSAtIChiLnJlY29yZC5kYXRlICE9IG51bGwpKSB8fFxyXG5cdFx0XHQoYS5yZWNvcmQuZGF0ZSAtIGIucmVjb3JkLmRhdGUpKTtcclxuXHR9KTtcclxuXHJcblx0dmFyIGxhc3RCdWlsZGluZyA9IG51bGw7XHJcblx0dmFyIGxhc3RTZWN0aW9uID0gbnVsbDtcclxuXHR2YXIgbGFzdEZsb29yID0gbnVsbDtcclxuXHR2YXIgbGFzdFR5cGUgPSBudWxsO1xyXG5cclxuXHRmb3IgKHZhciBpID0gMCwgYyA9IG9iamVjdHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHR2YXIgb2JqID0gb2JqZWN0c1tpXTtcclxuXHRcdGlmICghR3JpZFZpZXcuaXNTdXBwb3J0ZWRPYmplY3Qob2JqKSlcclxuXHRcdFx0Y29udGludWU7XHJcblxyXG5cdFx0dmFyIGJ1aWxkaW5nID0gb2JqLmJ1aWxkaW5nO1xyXG5cdFx0dmFyIHNlY3Rpb24gPSBvYmouc2VjdGlvbjtcclxuXHRcdGlmIChidWlsZGluZyAhPSBsYXN0QnVpbGRpbmcgfHwgc2VjdGlvbiAhPSBsYXN0U2VjdGlvbikge1xyXG5cdFx0XHRpZiAobGFzdEZsb29yICE9IG51bGwgfHwgbGFzdFR5cGUgIT0gbnVsbCkge1xyXG5cdFx0XHRcdGFjYy5wdXNoKFwiPC9kaXY+XCIpO1xyXG5cdFx0XHRcdGxhc3RGbG9vciA9IG51bGw7XHJcblx0XHRcdFx0bGFzdFR5cGUgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChsYXN0QnVpbGRpbmcgIT0gbnVsbCkge1xyXG5cdFx0XHRcdHJlbmRlckJ1aWxkaW5nQW5kU2VjdGlvbkluZm8obGFzdEJ1aWxkaW5nLCBsYXN0U2VjdGlvbiwgYWNjKTtcclxuXHRcdFx0XHRhY2MucHVzaChcIjwvZGl2PlwiKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YWNjLnB1c2goXCI8ZGl2IGNsYXNzPSdncmlkX3NlY3Rpb24nPlwiKTtcclxuXHRcdFx0bGFzdEJ1aWxkaW5nID0gYnVpbGRpbmc7XHJcblx0XHRcdGxhc3RTZWN0aW9uID0gc2VjdGlvbjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZmxvb3IgPSBvYmouZmxvb3I7XHJcblx0XHR2YXIgdHlwZSA9IG9iai5jb25zdHJ1Y3Rvci5uYW1lO1xyXG5cdFx0aWYgKGZsb29yICE9IGxhc3RGbG9vciB8fCB0eXBlICE9IGxhc3RUeXBlKSB7XHJcblx0XHRcdGlmIChsYXN0Rmxvb3IgIT0gbnVsbCB8fCBsYXN0VHlwZSAhPSBudWxsKVxyXG5cdFx0XHRcdGFjYy5wdXNoKFwiPC9kaXY+XCIpO1xyXG5cdFx0XHRhY2MucHVzaChgPGRpdiBjbGFzcz0nZ3JpZF9mbG9vciBncmlkX2Zsb29yX18ke3R5cGV9Jz5gKTtcclxuXHRcdFx0cmVuZGVyRmxvb3JJbmZvKG9iaiwgYWNjKTtcclxuXHRcdFx0bGFzdEZsb29yID0gZmxvb3I7XHJcblx0XHRcdGxhc3RUeXBlID0gdHlwZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZW5kZXJPYmplY3RJbmZvKGdyaWRVaWQsIG9iaiwgc2VhcmNoUmVzdWx0cywgYWNjKTtcclxuXHR9XHJcblxyXG5cdGFjYy5wdXNoKFwiPC9kaXY+XCIpO1xyXG5cdHJlbmRlckJ1aWxkaW5nQW5kU2VjdGlvbkluZm8obGFzdEJ1aWxkaW5nLCBsYXN0U2VjdGlvbiwgYWNjKTtcclxuXHRhY2MucHVzaChcIjwvZGl2PlwiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyQnVpbGRpbmdBbmRTZWN0aW9uSW5mbyhsYXN0QnVpbGRpbmcsIGxhc3RTZWN0aW9uLCBhY2MpIHtcclxuXHRhY2MucHVzaChgPGRpdiBjbGFzcz0nZ3JpZF9zZWN0aW9uSW5mbyc+0JrQvtGA0L/Rg9GBICR7bGFzdEJ1aWxkaW5nfSDQodC10LrRhtC40Y8gJHtsYXN0U2VjdGlvbiA9PSBudWxsID8gcy5Vbmtub3duIDogbGFzdFNlY3Rpb259PC9kaXY+YCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlckZsb29ySW5mbyhvYmosIGFjYykge1xyXG5cdGlmIChvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudCkge1xyXG5cdFx0YWNjLnB1c2goXCI8c3BhbiBjbGFzcz0nZ3JpZF9mbG9vck51bWJlcic+XCIpO1xyXG5cdFx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShvYmouZmxvb3IudG9TdHJpbmcoKSkpO1xyXG5cdFx0YWNjLnB1c2goXCI8L3NwYW4+XCIpO1xyXG5cdH1cclxuXHRlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBtLk5vblJlc2lkZW50aWFsUHJlbWlzZSlcclxuXHRcdGFjYy5wdXNoKGA8c3BhbiBjbGFzcz0nZ3JpZF9mbG9vck51bWJlcicgdGl0bGU9J9Cd0LXQttC40LvRi9C1INC/0L7QvNC10YnQtdC90LjRjyc+JHtzLkNyb3NzfTwvc3Bhbj5gKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyT2JqZWN0SW5mbyhncmlkVWlkLCBvYmosIHNlYXJjaFJlc3VsdHMsIGFjYykge1xyXG5cdHZhciBjc3NDbGFzc2VzID0gW1wiZ3JpZF9vYmplY3RcIl07XHJcblx0aWYgKG9iai5kdXBsaWNhdGUpXHJcblx0XHRjc3NDbGFzc2VzLnB1c2goXCJncmlkX29iamVjdF9fZHVwbGljYXRlXCIpO1xyXG5cdGlmIChvYmoub3JpZ2luYWxOdW1iZXIgIT0gbnVsbClcclxuXHRcdGNzc0NsYXNzZXMucHVzaChcImdyaWRfb2JqZWN0X193aXRoT3JpZ2luYWxOdW1iZXJcIik7XHJcblx0aWYgKHNlYXJjaFJlc3VsdHMuaW5kZXhPZihvYmouaWQpID49IDApXHJcblx0XHRjc3NDbGFzc2VzLnB1c2goXCJncmlkX29iamVjdF9fc2VhcmNoXCIpO1xyXG5cdGNzc0NsYXNzZXMgPSBjc3NDbGFzc2VzLmpvaW4oXCIgXCIpO1xyXG5cclxuXHRhY2MucHVzaChgPGRpdiBjbGFzcz1cIiR7Y3NzQ2xhc3Nlc31cIiBpZD1cIiR7Z3JpZFVpZCArIFwiX29iai1cIiArIG9iai5pZH1cIj5gKTtcclxuXHRpZiAob2JqLm51bWJlciAhPSBudWxsKVxyXG5cdFx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShvYmoubnVtYmVyLnRvU3RyaW5nKCkpKTtcclxuXHRhY2MucHVzaChcIjwvZGl2PlwiKTtcclxufVxyXG4iLCJ2YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIEdyaWRWaWV3IGV4dGVuZHMgVmlldyB7XHJcblx0Y29uc3RydWN0b3IobW9kZWwpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cclxuXHRcdHZhciBzZWFyY2hNb2RlbCA9IG5ldyBTZWFyY2hNb2RlbCgpO1xyXG5cdFx0dmFyIHJlY29yZFNlbGVjdGlvbk1vZGVsID0gbmV3IFJlY29yZFNlbGVjdGlvbk1vZGVsKCk7XHJcblx0XHRtZS5zZWFyY2hWaWV3ID0gbWUuYWRkQ2hpbGQobmV3IFNlYXJjaFZpZXcobW9kZWwsIHNlYXJjaE1vZGVsKSk7XHJcblx0XHRtZS5yZWNvcmRJbmZvID0gbWUuYWRkQ2hpbGQobmV3IFJlY29yZEluZm8ocmVjb3JkU2VsZWN0aW9uTW9kZWwpKTtcclxuXHRcdG1lLmdyaWQgPSBtZS5hZGRDaGlsZChuZXcgR3JpZChtb2RlbCwgc2VhcmNoTW9kZWwsIHJlY29yZFNlbGVjdGlvbk1vZGVsKSk7XHJcblxyXG5cdFx0Ly8gaGFuZGxlIHRoaXMgc2lnbmFsIGhlcmUgdG8gY29udHJvbCB0aGUgb3JkZXIgb2YgY2hpbGQgdmlld3MnIHVwZGF0ZXNcclxuXHRcdG1vZGVsLm9uQ2hhbmdlZC5iaW5kKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRyZWNvcmRTZWxlY3Rpb25Nb2RlbC5jbGVhcigpO1xyXG5cdFx0XHRzZWFyY2hNb2RlbC5vbkNoYW5nZWQubXV0ZSgpO1xyXG5cdFx0XHRtZS5zZWFyY2hWaWV3LmFwcGx5KCk7XHJcblx0XHRcdHNlYXJjaE1vZGVsLm9uQ2hhbmdlZC5tdXRlKC0xKTtcclxuXHRcdFx0bWUuZ3JpZC5yZWRyYXcoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHRnZXRIdG1sKCkge1xyXG5cdFx0cmV0dXJuIGBcclxuXHRcdFx0PGRpdiBpZD1cIiR7dGhpcy51aWR9XCIgY2xhc3M9XCJncmlkdmlld1wiPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3M9XCJncmlkdmlld19zaWRlYmFyXCI+XHJcblx0XHRcdFx0XHQke3RoaXMuc2VhcmNoVmlldy5nZXRIdG1sKCl9XHJcblx0XHRcdFx0XHQke3RoaXMucmVjb3JkSW5mby5nZXRIdG1sKCl9XHJcblx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0JHt0aGlzLmdyaWQuZ2V0SHRtbCgpfVxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdGA7XHJcblx0fVxyXG59XHJcblxyXG5HcmlkVmlldy5pc1N1cHBvcnRlZE9iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xyXG5cdHJldHVybiBvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudCB8fCBvYmogaW5zdGFuY2VvZiBtLk5vblJlc2lkZW50aWFsUHJlbWlzZTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZFZpZXc7XHJcblxyXG52YXIgR3JpZCA9IHJlcXVpcmUoXCJhcHAvdmlld3MvR3JpZFwiKTtcclxudmFyIFNlYXJjaFZpZXcgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1NlYXJjaFZpZXdcIik7XHJcbnZhciBTZWFyY2hNb2RlbCA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvU2VhcmNoTW9kZWxcIik7XHJcbnZhciBSZWNvcmRTZWxlY3Rpb25Nb2RlbCA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvUmVjb3JkU2VsZWN0aW9uTW9kZWxcIik7XHJcbnZhciBSZWNvcmRJbmZvID0gcmVxdWlyZShcImFwcC92aWV3cy9SZWNvcmRJbmZvXCIpO1xyXG52YXIgbSA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxDbGFzc2VzXCIpO1xyXG4iLCJ2YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIEluY29tcGF0aWJsZUJyb3dzZXJWaWV3IGV4dGVuZHMgVmlld1xyXG57XHJcblx0Z2V0SHRtbCgpIHtcclxuXHRcdHJldHVybiBgXHJcblx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkfVwiIGNsYXNzPVwiaW5jb21wYXRpYmxlYnJvd3NlclwiPlxyXG5cdFx0XHRcdNCaINGB0L7QttCw0LvQtdC90LjRjiwg0JLQsNGI0LAg0LLQtdGA0YHQuNGPINCx0YDQsNGD0LfQtdGA0LAg0L3QtSDQv9C+0LTQtNC10YDQttC40LLQsNC10YLRgdGPLjxici8+XHJcblx0XHRcdFx00JTQu9GPINC+0YLQutGA0YvRgtC40Y8g0YjQsNGF0LzQsNGC0LrQuCDRgNC10LrQvtC80LXQvdC00YPQtdGC0YHRjyDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0L/QvtGB0LvQtdC00L3RjtGOINCy0LXRgNGB0LjRjiDQsdGA0LDRg9C30LXRgNC+0LIgR29vZ2xlIENocm9tZSwgTW96aWxsYSBGaXJlZm94INC40LvQuCBNaWNyb3NvZnQgRWRnZS5cclxuXHRcdFx0PC9kaXY+YDtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSW5jb21wYXRpYmxlQnJvd3NlclZpZXc7XHJcbiIsInZhciBWaWV3ID0gcmVxdWlyZShcImFwcC92aWV3cy9WaWV3XCIpO1xyXG5cclxuY2xhc3MgTWFpblZpZXcgZXh0ZW5kcyBWaWV3XHJcbntcclxuXHRjb25zdHJ1Y3Rvcihtb2RlbCwgbG9hZENvbnRyb2xsZXIpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHRNYWluVmlldy5pbnN0YW5jZSA9IHRoaXM7XHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cclxuXHRcdG1lLl9sb2FkQ29udHJvbGxlciA9IGxvYWRDb250cm9sbGVyO1xyXG5cclxuXHRcdG1lLnBvcHVwTWFuYWdlciA9IG5ldyBQb3B1cE1hbmFnZXIoKTtcclxuXHJcblx0XHRtZS50YWJDb250cm9sID0gbWUuYWRkQ2hpbGQobmV3IFRhYkNvbnRyb2woKSk7XHJcblx0XHRtZS50YWJDb250cm9sLmFkZFRhYihUYWIuRGF0YSwgXCLQlNCw0L3QvdGL0LVcIik7XHJcblx0XHRtZS50YWJDb250cm9sLmFkZFRhYihUYWIuR3JpZCwgXCLQqNCw0YXQvNCw0YLQutCwXCIpO1xyXG5cdFx0bWUudGFiQ29udHJvbC5hZGRUYWIoVGFiLlNxbCwgXCJTUUxcIik7XHJcblxyXG5cdFx0bWUuZGF0YVZpZXcgPSBtZS5hZGRDaGlsZChuZXcgRGF0YVZpZXcobG9hZENvbnRyb2xsZXIpKTtcclxuXHRcdG1lLmdyaWRWaWV3ID0gbWUuYWRkQ2hpbGQobmV3IEdyaWRWaWV3KG1vZGVsKSk7XHJcblx0XHRtZS5zcWxWaWV3ID0gbWUuYWRkQ2hpbGQobmV3IFNxbFZpZXcobW9kZWwuc3FsTW9kZWwpKTtcclxuXHRcdG1lLl9vblRhYkNoYW5nZWQoKTtcclxuXHJcblx0XHRtZS50YWJDb250cm9sLm9uQWN0aXZlSWRDaGFuZ2VkLmJpbmQoZnVuY3Rpb24oKSB7IG1lLl9vblRhYkNoYW5nZWQoKTsgfSk7XHJcblxyXG5cdFx0bW9kZWwub25DaGFuZ2VkLmJpbmQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdGlmIChtZS5nZXRBY3RpdmVUYWIoKSA9PSBUYWIuRGF0YSlcclxuXHRcdFx0XHRtZS5zZXRBY3RpdmVUYWIoVGFiLkdyaWQpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdGdldEh0bWwoKSB7XHJcblx0XHRyZXR1cm4gYFxyXG5cdFx0XHQ8ZGl2IGlkPVwiJHt0aGlzLnVpZH1cIiBjbGFzcz1cIm1haW52aWV3XCI+XHJcblx0XHRcdFx0JHt0aGlzLnRhYkNvbnRyb2wuZ2V0SHRtbCgpfVxyXG5cdFx0XHRcdCR7dGhpcy5kYXRhVmlldy5nZXRIdG1sKCl9XHJcblx0XHRcdFx0JHt0aGlzLmdyaWRWaWV3LmdldEh0bWwoKX1cclxuXHRcdFx0XHQke3RoaXMuc3FsVmlldy5nZXRIdG1sKCl9XHJcblx0XHRcdDwvZGl2PlxyXG5cdFx0YDtcclxuXHR9XHJcblxyXG5cdGdldEFjdGl2ZVRhYigpIHtcclxuXHRcdHJldHVybiB0aGlzLnRhYkNvbnRyb2wuYWN0aXZlSWQoKTtcclxuXHR9XHJcblx0c2V0QWN0aXZlVGFiKHZhbHVlKSB7XHJcblx0XHRpZiAodGhpcy50YWJDb250cm9sLmFjdGl2ZUlkKHZhbHVlKSlcclxuXHRcdFx0dGhpcy5fb25UYWJDaGFuZ2VkKCk7XHJcblx0fVxyXG5cdF9vblRhYkNoYW5nZWQoKSB7XHJcblx0XHR2YXIgaWQgPSB0aGlzLnRhYkNvbnRyb2wuYWN0aXZlSWQoKTtcclxuXHRcdHRoaXMuZGF0YVZpZXcuc2V0VmlzaWJsZShpZCA9PSBUYWIuRGF0YSk7XHJcblx0XHR0aGlzLmdyaWRWaWV3LnNldFZpc2libGUoaWQgPT0gVGFiLkdyaWQpO1xyXG5cdFx0dGhpcy5zcWxWaWV3LnNldFZpc2libGUoaWQgPT0gVGFiLlNxbCk7XHJcblx0fVxyXG59XHJcblxyXG52YXIgVGFiID0ge1xyXG5cdERhdGE6IDEsXHJcblx0R3JpZDogMixcclxuXHRTcWw6IDMsXHJcbn07XHJcblxyXG5NYWluVmlldy5pbnN0YW5jZSA9IG51bGw7XHJcbk1haW5WaWV3LlRhYiA9IFRhYjtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTWFpblZpZXc7XHJcblxyXG52YXIgVGFiQ29udHJvbCA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVGFiQ29udHJvbFwiKTtcclxudmFyIERhdGFWaWV3ID0gcmVxdWlyZShcImFwcC92aWV3cy9EYXRhVmlld1wiKTtcclxudmFyIEdyaWRWaWV3ID0gcmVxdWlyZShcImFwcC92aWV3cy9HcmlkVmlld1wiKTtcclxudmFyIFNxbFZpZXcgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1NxbFZpZXdcIik7XHJcbnZhciBQb3B1cE1hbmFnZXIgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1BvcHVwTWFuYWdlclwiKTtcclxuIiwidmFyIFZpZXcgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1ZpZXdcIik7XHJcblxyXG5jbGFzcyBPYmplY3RQb3B1cCBleHRlbmRzIFZpZXcge1xyXG5cdGdldEh0bWwoKSB7XHJcblx0XHRyZXR1cm4gYFxyXG5cdFx0XHQ8ZGl2IGlkPVwiJHt0aGlzLnVpZH1cIiBjbGFzcz1cIm9iamVjdHBvcHVwXCI+XHJcblx0XHRcdDwvZGl2PlxyXG5cdFx0YDtcclxuXHR9XHJcblx0b25JbnN0YWxsZWQoKSB7XHJcblx0XHRzdXBlci5vbkluc3RhbGxlZCguLi5hcmd1bWVudHMpO1xyXG5cdH1cclxuXHRzZXRPYmplY3Qob2JqZWN0KSB7XHJcblx0XHR2YXIgYWNjID0gW107XHJcblx0XHRyZW5kZXIob2JqZWN0LCBhY2MpO1xyXG5cdFx0dGhpcy4kZWxlbWVudCgpLmh0bWwoYWNjLmpvaW4oXCJcIikpO1xyXG5cdH1cclxuXHRzaG93KGV2KSB7XHJcblx0XHR2YXIgJGVsID0gdGhpcy4kZWxlbWVudCgpO1xyXG5cclxuXHRcdHZhciBsZWZ0ID0gZXYucGFnZVg7XHJcblx0XHR2YXIgdG9wID0gZXYucGFnZVk7XHJcblx0XHQkZWwuY3NzKHsgbGVmdCwgdG9wIH0pLnNob3coKTtcclxuXHJcblx0XHR2YXIgdyA9ICRlbC5vdXRlcldpZHRoKCk7XHJcblx0XHRpZiAobGVmdCArIHcgPiB3aW5kb3cuc2Nyb2xsWCArIHdpbmRvdy5pbm5lcldpZHRoICYmIGxlZnQgLSB3ID4gd2luZG93LnNjcm9sbFgpXHJcblx0XHRcdCRlbC5jc3MoXCJsZWZ0XCIsIGxlZnQgLSB3KTtcclxuXHJcblx0XHR2YXIgaCA9ICRlbC5vdXRlckhlaWdodCgpO1xyXG5cdFx0aWYgKHRvcCArIGggPiB3aW5kb3cuc2Nyb2xsWSArIHdpbmRvdy5pbm5lckhlaWdodCAmJiB0b3AgLSBoID4gd2luZG93LnNjcm9sbFkpXHJcblx0XHRcdCRlbC5jc3MoXCJ0b3BcIiwgdG9wIC0gaCk7XHJcblxyXG5cdFx0TWFpblZpZXcuaW5zdGFuY2UucG9wdXBNYW5hZ2VyLnJlZ2lzdGVyUG9wdXAoJGVsWzBdKTtcclxuXHR9XHJcblx0aGlkZSgpIHtcclxuXHRcdHRoaXMuJGVsZW1lbnQoKS5oaWRlKCk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdFBvcHVwO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxudmFyIHMgPSByZXF1aXJlKFwiYXBwL1N0cmluZ3NcIik7XHJcbnZhciBtID0gcmVxdWlyZShcImFwcC9tb2RlbC9Nb2RlbENsYXNzZXNcIik7XHJcbnZhciBNYWluVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvTWFpblZpZXdcIik7XHJcblxyXG5mdW5jdGlvbiByZW5kZXIob2JqLCBhY2MpIHtcclxuXHRhY2MucHVzaCh1dGlscy5odG1sRW5jb2RlKG9iai50eXBlKSk7XHJcblx0YWNjLnB1c2goXCIg4oSWXCIpO1xyXG5cdGlmIChvYmoub3JpZ2luYWxOdW1iZXIgIT0gbnVsbCkge1xyXG5cdFx0YWNjLnB1c2goXCI8c3BhbiBjbGFzcz0nb2JqZWN0cG9wdXBfd2l0aE9yaWdpbmFsTnVtYmVyJz5cIik7XHJcblx0XHRhY2MucHVzaCh1dGlscy5odG1sRW5jb2RlKG9iai5udW1iZXIudG9TdHJpbmcoKSkpO1xyXG5cdFx0YWNjLnB1c2goXCI8L3NwYW4+XCIpO1xyXG5cdFx0YWNjLnB1c2goXCIgKFwiKTtcclxuXHRcdGFjYy5wdXNoKHV0aWxzLmh0bWxFbmNvZGUob2JqLm9yaWdpbmFsTnVtYmVyLnRvU3RyaW5nKCkpKTtcclxuXHRcdGFjYy5wdXNoKFwiKVwiKTtcclxuXHR9XHJcblx0ZWxzZVxyXG5cdFx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShvYmoubnVtYmVyLnRvU3RyaW5nKCkpKTtcclxuXHRhY2MucHVzaChcIjxicj5cIik7XHJcblxyXG5cdGFjYy5wdXNoKFwi0JrQvtGA0L/Rg9GBIFwiKTtcclxuXHRhY2MucHVzaCh1dGlscy5odG1sRW5jb2RlKG9iai5idWlsZGluZy50b1N0cmluZygpKSk7XHJcblx0YWNjLnB1c2goXCIsINGB0LXQutGG0LjRjyBcIik7XHJcblx0YWNjLnB1c2gob2JqLnNlY3Rpb24gPT0gbnVsbCA/IHMuVW5rbm93biA6IHV0aWxzLmh0bWxFbmNvZGUob2JqLnNlY3Rpb24udG9TdHJpbmcoKSkpO1xyXG5cdGFjYy5wdXNoKFwiLCDRjdGC0LDQtiBcIik7XHJcblx0YWNjLnB1c2gob2JqLmZsb29yID09IG51bGwgPyBzLlVua25vd24gOiB1dGlscy5odG1sRW5jb2RlKG9iai5mbG9vci50b1N0cmluZygpKSk7XHJcblx0YWNjLnB1c2goXCI8YnI+XCIpO1xyXG5cclxuXHRhY2MucHVzaChcItCd0L7QvNC10YAg0L3QsCDQv9C70L7RidCw0LTQutC1IFwiKTtcclxuXHRhY2MucHVzaChvYmoubGFuZGluZ051bWJlciA9PSBudWxsID8gcy5Vbmtub3duIDogdXRpbHMuaHRtbEVuY29kZShvYmoubGFuZGluZ051bWJlci50b1N0cmluZygpKSk7XHJcblx0YWNjLnB1c2goXCI8YnI+XCIpO1xyXG5cclxuXHRhY2MucHVzaChcItCf0LvQvtGJ0LDQtNGMIFwiKTtcclxuXHRhY2MucHVzaChvYmouYXJlYS50b1N0cmluZygpKTtcclxuXHRhY2MucHVzaChcIiDQutCyLtC8LlwiKTtcclxuXHRhY2MucHVzaChcIjxicj5cIik7XHJcblxyXG5cdGFjYy5wdXNoKG9iai5yZWNvcmQudHlwZSk7XHJcblx0YWNjLnB1c2gob2JqLnJlY29yZCBpbnN0YW5jZW9mIG0uT3duZXJzUmVnaXN0cnlSZWNvcmQgPyBcIiw8YnI+XCIgOiBcIiwgXCIpO1xyXG5cdGFjYy5wdXNoKFwi0LfQsNC/0LjRgdGMIOKEllwiKTtcclxuXHRhY2MucHVzaCh1dGlscy5odG1sRW5jb2RlKG9iai5yZWNvcmQubnVtYmVyLnRvU3RyaW5nKCkpKTtcclxuXHRhY2MucHVzaChcIjxicj5cIik7XHJcblxyXG5cdGFjYy5wdXNoKFwi0JTQsNGC0LAg0YDQtdCz0LjRgdGC0YDQsNGG0LjQuCBcIik7XHJcblx0YWNjLnB1c2gob2JqLnJlY29yZC5kYXRlID09IG51bGwgPyBzLlVua25vd24gOiB1dGlscy5odG1sRW5jb2RlKHMuZm9ybWF0RGF0ZShvYmoucmVjb3JkLmRhdGUpKSk7XHJcbn1cclxuIiwiY2xhc3MgUG9wdXBNYW5hZ2VyIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblx0XHRtZS5fYWN0aXZlUG9wdXAgPSBudWxsOyAvKiA6IERPTUVsZW1lbnQgKi9cclxuXHRcdCQoZG9jdW1lbnQuYm9keSkubW91c2Vkb3duKGZ1bmN0aW9uKGV2KSB7XHJcblx0XHRcdGlmIChtZS5fYWN0aXZlUG9wdXAgJiYgJChldi50YXJnZXQpLmNsb3Nlc3QobWUuX2FjdGl2ZVBvcHVwKS5sZW5ndGggPT0gMClcclxuXHRcdFx0XHRtZS5faGlkZSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHJlZ2lzdGVyUG9wdXAoZWwpIHtcclxuXHRcdGlmICghZWwpIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IGlzIG51bGw6IGVsXCIpO1xyXG5cdFx0aWYgKGVsID09IHRoaXMuX2FjdGl2ZVBvcHVwKSByZXR1cm47XHJcblx0XHR0aGlzLl9oaWRlKCk7XHJcblx0XHR0aGlzLl9hY3RpdmVQb3B1cCA9IGVsO1xyXG5cdH1cclxuXHRfaGlkZSgpIHtcclxuXHRcdGlmICh0aGlzLl9hY3RpdmVQb3B1cCkge1xyXG5cdFx0XHQkKHRoaXMuX2FjdGl2ZVBvcHVwKS5oaWRlKCk7XHJcblx0XHRcdHRoaXMuX2FjdGl2ZVBvcHVwID0gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUG9wdXBNYW5hZ2VyO1xyXG4iLCJ2YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIFJlY29yZEluZm8gZXh0ZW5kcyBWaWV3IHtcclxuXHRjb25zdHJ1Y3RvcihyZWNvcmRTZWxlY3Rpb25Nb2RlbCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHR2YXIgbWUgPSB0aGlzO1xyXG5cdFx0bWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsID0gcmVjb3JkU2VsZWN0aW9uTW9kZWw7XHJcblxyXG5cdFx0bWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsLm9uQ2hhbmdlZC5iaW5kKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgcmVjb3JkID0gbWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsLmdldFJlY29yZCgpO1xyXG5cdFx0XHRtZS5fcmVkcmF3KHJlY29yZCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0Z2V0SHRtbCgpIHtcclxuXHRcdHJldHVybiBgXHJcblx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkfVwiIGNsYXNzPVwicmVjb3JkaW5mb1wiPlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdGA7XHJcblx0fVxyXG5cdG9uSW5zdGFsbGVkKCkge1xyXG5cdFx0c3VwZXIub25JbnN0YWxsZWQoLi4uYXJndW1lbnRzKTtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblxyXG5cdFx0bWUuJGVsZW1lbnQoKS5jbGljayhmdW5jdGlvbihldikge1xyXG5cdFx0XHRpZiAoJChldi50YXJnZXQpLmNsb3Nlc3QoXCIucmVjb3JkaW5mb19jbG9zZVwiKS5sZW5ndGgpXHJcblx0XHRcdFx0bWUuX3JlY29yZFNlbGVjdGlvbk1vZGVsLmNsZWFyKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0X3JlZHJhdygvKiBvcHRpb25hbCAqLyByZWNvcmQpIHtcclxuXHRcdHZhciBhY2MgPSBbXTtcclxuXHRcdGlmIChyZWNvcmQpXHJcblx0XHRcdHJlbmRlcihyZWNvcmQsIGFjYyk7XHJcblx0XHR0aGlzLiRlbGVtZW50KCkuaHRtbChhY2Muam9pbihcIlwiKSk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJlY29yZEluZm87XHJcblxyXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiYXBwL3V0aWxzXCIpO1xyXG52YXIgbSA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvTW9kZWxDbGFzc2VzXCIpO1xyXG52YXIgcyA9IHJlcXVpcmUoXCJhcHAvU3RyaW5nc1wiKTtcclxuXHJcbmZ1bmN0aW9uIHJlbmRlcihyZWNvcmQsIGFjYykge1xyXG5cdGFjYy5wdXNoKGA8ZGl2IGNsYXNzPSdjYXB0aW9uJz7QmNC90YTQvtGA0LzQsNGG0LjRjyDQviDQt9Cw0L/QuNGB0LggPHNwYW4gY2xhc3M9J3JlY29yZGluZm9fY2xvc2UnPiR7cy5Dcm9zc308L3NwYW4+PC9kaXY+YCk7XHJcblx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShyZWNvcmQudHlwZSkpO1xyXG5cdGFjYy5wdXNoKFwiLCDihJZcIik7XHJcblx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShyZWNvcmQubnVtYmVyLnRvU3RyaW5nKCkpKTtcclxuXHRhY2MucHVzaChcIjxici8+XCIpO1xyXG5cclxuXHRpZiAocmVjb3JkIGluc3RhbmNlb2YgbS5QYXJ0aWNpcGFudHNSZWdpc3RyeVJlY29yZCkge1xyXG5cdFx0YWNjLnB1c2goXCI8ZGl2IGNsYXNzPSdyZWNvcmRpbmZvX3NvdXJjZSc+XCIpO1xyXG5cdFx0YWNjLnB1c2godXRpbHMuaHRtbEVuY29kZShyZWNvcmQuc291cmNlKSk7XHJcblx0XHRhY2MucHVzaChcIjwvZGl2PlwiKTtcclxuXHR9XHJcblx0ZWxzZSBpZiAocmVjb3JkIGluc3RhbmNlb2YgbS5Pd25lcnNSZWdpc3RyeVJlY29yZClcclxuXHRcdGFjYy5wdXNoKHV0aWxzLmh0bWxFbmNvZGUocmVjb3JkLm93bmVyKSk7XHJcblx0ZWxzZVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwi0J3QtdC40LfQstC10YHRgtC90YvQuSDRgtC40L8g0LfQsNC/0LjRgdC4OiBcIiArIHJlY29yZC5jb25zdHJ1Y3Rvci5uYW1lKTtcclxufVxyXG4iLCJ2YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIFNlYXJjaFZpZXcgZXh0ZW5kcyBWaWV3IHtcclxuXHRjb25zdHJ1Y3Rvcihtb2RlbCwgc2VhcmNoTW9kZWwpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xyXG5cdFx0dGhpcy5fc2VhcmNoTW9kZWwgPSBzZWFyY2hNb2RlbDtcclxuXHR9XHJcblx0Z2V0SHRtbCgpIHtcclxuXHRcdHJldHVybiBgXHJcblx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkfVwiIGNsYXNzPVwic2VhcmNodmlld1wiPlxyXG5cdFx0XHRcdDxkaXYgY2xhc3M9XCJjYXB0aW9uXCI+0J/QvtC40YHQujwvZGl2PlxyXG5cdFx0XHRcdDxsYWJlbD7QotC40L8g0LfQsNC/0LjRgdC4OiA8c2VsZWN0IGlkPVwiJHt0aGlzLnVpZCArIFwiX3JlY29yZFR5cGVcIn1cIj5cclxuXHRcdFx0XHRcdDxvcHRpb24+XHJcblx0XHRcdFx0XHQ8b3B0aW9uIHZhbHVlPVwi0JXQk9Cg0J9cIj7QldCT0KDQnzwvb3B0aW9uPlxyXG5cdFx0XHRcdFx0PG9wdGlvbiB2YWx1ZT1cItCg0LXQtdGB0YLRgCDRgdC+0LHRgdGC0LLQtdC90L3QuNC60L7QsiDQtNC+0LvQtdC5XCI+0KDQtdC10YHRgtGAINGB0L7QsdGB0YLQstC10L3QvdC40LrQvtCyINC00L7Qu9C10Lk8L29wdGlvbj5cclxuXHRcdFx0XHQ8L3NlbGVjdD48L2xhYmVsPlxyXG5cdFx0XHRcdDxsYWJlbD7QndC+0LzQtdGAINC30LDQv9C40YHQuDogPGlucHV0IGlkPVwiJHt0aGlzLnVpZCArIFwiX3JlY29yZE51bWJlclwifVwiIHNpemU9XCI1XCI+PC9sYWJlbD5cclxuXHRcdFx0XHQ8bGFiZWw+0KLQtdC60YHRgiDQsiDQt9Cw0L/QuNGB0Lg6PGJyLz48aW5wdXQgaWQ9XCIke3RoaXMudWlkICsgXCJfcmVjb3JkVGV4dFwifVwiIHNpemU9XCI0MFwiPjwvbGFiZWw+XHJcblx0XHRcdFx00JTQsNGC0LAg0YDQtdCz0LjRgdGC0YDQsNGG0LjQuFxyXG5cdFx0XHRcdFx0PGxhYmVsPtGBIDxpbnB1dCB0eXBlPVwiZGF0ZVwiIGlkPVwiJHt0aGlzLnVpZCArIFwiX2RhdGVGcm9tXCJ9XCI+PC9sYWJlbD5cclxuXHRcdFx0XHRcdDxsYWJlbD7Qv9C+IDxpbnB1dCB0eXBlPVwiZGF0ZVwiIGlkPVwiJHt0aGlzLnVpZCArIFwiX2RhdGVUb1wifVwiPjwvbGFiZWw+XHJcblx0XHRcdFx0PGxhYmVsPtCb0LjRhtC+OiA8c2VsZWN0IGlkPVwiJHt0aGlzLnVpZCArIFwiX3BlcnNvblwifVwiPlxyXG5cdFx0XHRcdFx0PG9wdGlvbj5cclxuXHRcdFx0XHRcdDxvcHRpb24gdmFsdWU9XCJwaHlzaWNhbFwiPtCk0LjQt9C40YfQtdGB0LrQvtC1PC9vcHRpb24+XHJcblx0XHRcdFx0XHQ8b3B0aW9uIHZhbHVlPVwianVyaWRpY2FsXCI+0K7RgNC40LTQuNGH0LXRgdC60L7QtTwvb3B0aW9uPlxyXG5cdFx0XHRcdDwvc2VsZWN0PjwvbGFiZWw+XHJcblx0XHRcdFx0PGxhYmVsPtCa0L7Qu9C40YfQtdGB0YLQstC+INC+0LHRitC10LrRgtC+0LIg0LIg0LfQsNC/0LjRgdC4IOKJpSA8aW5wdXQgaWQ9XCIke3RoaXMudWlkICsgXCJfb2JqZWN0c0NvdW50R2VcIn1cIiBzaXplPVwiNVwiPjwvbGFiZWw+XHJcblx0XHRcdFx0PGxhYmVsPtCa0L7Qu9C40YfQtdGB0YLQstC+INC60LLQsNGA0YLQuNGAINCyINC30LDQv9C40YHQuCDiiaUgPGlucHV0IGlkPVwiJHt0aGlzLnVpZCArIFwiX2FwYXJ0bWVudHNDb3VudEdlXCJ9XCIgc2l6ZT1cIjVcIj48L2xhYmVsPlxyXG5cdFx0XHRcdDxsYWJlbD7QndC+0LzQtdGAINC+0LHRitC10LrRgtCwOiA8aW5wdXQgaWQ9XCIke3RoaXMudWlkICsgXCJfbnVtYmVyXCJ9XCIgc2l6ZT1cIjVcIj48L2xhYmVsPlxyXG5cdFx0XHRcdDxidXR0b24gaWQ9XCIke3RoaXMudWlkICsgXCJfYXBwbHlcIn1cIj7Qn9GA0LjQvNC10L3QuNGC0Yw8L2J1dHRvbj5cclxuXHRcdFx0XHQ8ZGl2IGNsYXNzPVwic2VhcmNodmlld19zZWFyY2hTdGF0c1wiPlxyXG5cdFx0XHRcdFx00J3QsNC50LTQtdC90L4gPHNwYW4gaWQ9XCIke3RoaXMudWlkICsgXCJfZm91bmRPYmplY3RzQ291bnRcIn1cIj4wINC+0LHRitC10LrRgtC+0LI8L3NwYW4+XHJcblx0XHRcdFx0XHQo0LjQtyDQvdC40YUgPHNwYW4gaWQ9XCIke3RoaXMudWlkICsgXCJfZm91bmRBcGFydG1lbnRzQ291bnRcIn1cIj4wINC60LLQsNGA0YLQuNGAPC9zcGFuPilcclxuXHRcdFx0XHRcdNCyIDxzcGFuIGlkPVwiJHt0aGlzLnVpZCArIFwiX2ZvdW5kUmVjb3Jkc0NvdW50XCJ9XCI+MCDQt9Cw0L/QuNGB0Y/RhTwvc3Bhbj5cclxuXHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0PC9kaXY+XHJcblx0XHRgO1xyXG5cdH1cclxuXHRvbkluc3RhbGxlZCgpIHtcclxuXHRcdHN1cGVyLm9uSW5zdGFsbGVkKC4uLmFyZ3VtZW50cyk7XHJcblxyXG5cdFx0dmFyIG1lID0gdGhpcztcclxuXHRcdHZhciAkZWwgPSBtZS4kZWxlbWVudCgpO1xyXG5cclxuXHRcdCRlbC5maW5kKFwiI1wiICsgbWUudWlkICsgXCJfYXBwbHlcIikuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRcdG1lLmFwcGx5KCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQkZWwuZmluZChcIjppbnB1dFwiKS5iaW5kKFwiY2hhbmdlIGlucHV0XCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRtZS5hcHBseSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdGFwcGx5KCkge1xyXG5cdFx0dmFyIGlkcyA9IFtdO1xyXG5cdFx0dmFyIHJlY29yZElkcyA9IHt9O1xyXG5cclxuXHRcdHZhciBmaWx0ZXJzID0gdGhpcy5fZ2V0RmlsdGVycygpO1xyXG5cdFx0aWYgKGZpbHRlcnMpIHtcclxuXHRcdFx0dmFyIG9iamVjdHMgPSB0aGlzLl9tb2RlbC5vYmplY3RzO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMCwgYyA9IG9iamVjdHMubGVuZ3RoOyBpIDwgYzsgaSsrKSB7XHJcblx0XHRcdFx0dmFyIG9iaiA9IG9iamVjdHNbaV07XHJcblx0XHRcdFx0aWYgKCFHcmlkVmlldy5pc1N1cHBvcnRlZE9iamVjdChvYmopKVxyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblxyXG5cdFx0XHRcdGlmIChmaWx0ZXJzLnJlY29yZFR5cGUgJiYgb2JqLnJlY29yZC50eXBlICE9IGZpbHRlcnMucmVjb3JkVHlwZSkgY29udGludWU7XHJcblx0XHRcdFx0aWYgKGZpbHRlcnMucmVjb3JkTnVtYmVyICE9IG51bGwgJiYgb2JqLnJlY29yZC5udW1iZXIgIT0gZmlsdGVycy5yZWNvcmROdW1iZXIpIGNvbnRpbnVlO1xyXG5cdFx0XHRcdGlmIChmaWx0ZXJzLnJlY29yZFRleHQgJiYgIShcclxuXHRcdFx0XHRcdG9iai5yZWNvcmQuc291cmNlICE9IG51bGwgJiYgb2JqLnJlY29yZC5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmRleE9mKGZpbHRlcnMucmVjb3JkVGV4dC50b0xvd2VyQ2FzZSgpKSA+PSAwIHx8XHJcblx0XHRcdFx0XHRvYmoucmVjb3JkLm93bmVyICE9IG51bGwgJiYgb2JqLnJlY29yZC5vd25lci50b0xvd2VyQ2FzZSgpLmluZGV4T2YoZmlsdGVycy5yZWNvcmRUZXh0LnRvTG93ZXJDYXNlKCkpID49IDApKSBjb250aW51ZTtcclxuXHRcdFx0XHRpZiAoZmlsdGVycy5kYXRlRnJvbSAmJiAhKG9iai5yZWNvcmQuZGF0ZSAmJiBvYmoucmVjb3JkLmRhdGUgPj0gZmlsdGVycy5kYXRlRnJvbSkpIGNvbnRpbnVlO1xyXG5cdFx0XHRcdGlmIChmaWx0ZXJzLmRhdGVUbyAmJiAhKG9iai5yZWNvcmQuZGF0ZSAmJiBvYmoucmVjb3JkLmRhdGUgPD0gZmlsdGVycy5kYXRlVG8pKSBjb250aW51ZTtcclxuXHRcdFx0XHRpZiAoZmlsdGVycy5wZXJzb24pIHtcclxuXHRcdFx0XHRcdGlmIChmaWx0ZXJzLnBlcnNvbiA9PSBcImp1cmlkaWNhbFwiICYmIG9iai5yZWNvcmQub3duZXIpIGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0aWYgKGZpbHRlcnMucGVyc29uID09IFwicGh5c2ljYWxcIiAmJiAhb2JqLnJlY29yZC5vd25lcikgY29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChmaWx0ZXJzLm51bWJlciAhPSBudWxsICYmICEob2JqLm51bWJlciA9PSBmaWx0ZXJzLm51bWJlciB8fCBvYmoub3JpZ2luYWxOdW1iZXIgPT0gZmlsdGVycy5udW1iZXIpKSBjb250aW51ZTtcclxuXHRcdFx0XHRpZiAoZmlsdGVycy5vYmplY3RzQ291bnRHZSAhPSBudWxsICYmIG9iai5yZWNvcmQub2JqZWN0cy5sZW5ndGggPCBmaWx0ZXJzLm9iamVjdHNDb3VudEdlKSBjb250aW51ZTtcclxuXHRcdFx0XHRpZiAoZmlsdGVycy5hcGFydG1lbnRzQ291bnRHZSAhPSBudWxsICYmIG9iai5yZWNvcmQub2JqZWN0cy5maWx0ZXIob2JqID0+IG9iaiBpbnN0YW5jZW9mIG0uQXBhcnRtZW50KS5sZW5ndGggPCBmaWx0ZXJzLmFwYXJ0bWVudHNDb3VudEdlKSBjb250aW51ZTtcclxuXHJcblx0XHRcdFx0aWRzLnB1c2gob2JqLmlkKTtcclxuXHRcdFx0XHRyZWNvcmRJZHNbb2JqLnJlY29yZC5pZF0gPSB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fc2hvd1NlYXJjaFN0YXRzKGlkcywgcmVjb3JkSWRzKTtcclxuXHRcdHRoaXMuX3NlYXJjaE1vZGVsLnNldE9iamVjdElkcyhpZHMpO1xyXG5cdH1cclxuXHRfZ2V0RmlsdGVycygpIHtcclxuXHRcdHZhciAkZWwgPSB0aGlzLiRlbGVtZW50KCk7XHJcblxyXG5cdFx0dmFyICRyZWNvcmRUeXBlID0gJGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3JlY29yZFR5cGVcIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdHZhciAkcmVjb3JkTnVtYmVyID0gJGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3JlY29yZE51bWJlclwiKS5yZW1vdmVDbGFzcyhcImVycm9yXCIpO1xyXG5cdFx0dmFyICRyZWNvcmRUZXh0ID0gJGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3JlY29yZFRleHRcIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdHZhciAkZGF0ZUZyb20gPSAkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfZGF0ZUZyb21cIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdHZhciAkZGF0ZVRvID0gJGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX2RhdGVUb1wiKS5yZW1vdmVDbGFzcyhcImVycm9yXCIpO1xyXG5cdFx0dmFyICRwZXJzb24gPSAkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfcGVyc29uXCIpLnJlbW92ZUNsYXNzKFwiZXJyb3JcIik7XHJcblx0XHR2YXIgJG51bWJlciA9ICRlbC5maW5kKFwiI1wiICsgdGhpcy51aWQgKyBcIl9udW1iZXJcIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdHZhciAkb2JqZWN0c0NvdW50R2UgPSAkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfb2JqZWN0c0NvdW50R2VcIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdHZhciAkYXBhcnRtZW50c0NvdW50R2UgPSAkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfYXBhcnRtZW50c0NvdW50R2VcIikucmVtb3ZlQ2xhc3MoXCJlcnJvclwiKTtcclxuXHJcblx0XHR2YXIgcmVjb3JkVHlwZSA9ICRyZWNvcmRUeXBlLnZhbCgpO1xyXG5cclxuXHRcdHZhciByZWNvcmROdW1iZXIgPSAkcmVjb3JkTnVtYmVyLnZhbCgpO1xyXG5cdFx0aWYgKCFyZWNvcmROdW1iZXIpXHJcblx0XHRcdHJlY29yZE51bWJlciA9IG51bGw7XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0cmVjb3JkTnVtYmVyID0gdXRpbHMucGFyc2VJbnQocmVjb3JkTnVtYmVyKTtcclxuXHRcdFx0aWYgKHJlY29yZE51bWJlciA9PSBudWxsKVxyXG5cdFx0XHRcdCRyZWNvcmROdW1iZXIuYWRkQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcmVjb3JkVGV4dCA9ICRyZWNvcmRUZXh0LnZhbCgpO1xyXG5cclxuXHRcdHZhciBkYXRlRnJvbSA9ICRkYXRlRnJvbS52YWwoKTtcclxuXHRcdGlmICghZGF0ZUZyb20pXHJcblx0XHRcdGRhdGVGcm9tID0gbnVsbDtcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRkYXRlRnJvbSA9IHV0aWxzLnBhcnNlRGF0ZShkYXRlRnJvbSk7XHJcblx0XHRcdGlmIChkYXRlRnJvbSA9PSBudWxsKVxyXG5cdFx0XHRcdCRkYXRlRnJvbS5hZGRDbGFzcyhcImVycm9yXCIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBkYXRlVG8gPSAkZGF0ZVRvLnZhbCgpO1xyXG5cdFx0aWYgKCFkYXRlVG8pXHJcblx0XHRcdGRhdGVUbyA9IG51bGw7XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZGF0ZVRvID0gdXRpbHMucGFyc2VEYXRlKGRhdGVUbyk7XHJcblx0XHRcdGlmIChkYXRlVG8gPT0gbnVsbClcclxuXHRcdFx0XHQkZGF0ZVRvLmFkZENsYXNzKFwiZXJyb3JcIik7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHBlcnNvbiA9ICRwZXJzb24udmFsKCk7XHJcblxyXG5cdFx0dmFyIG51bWJlciA9ICRudW1iZXIudmFsKCk7XHJcblx0XHRpZiAoIW51bWJlcilcclxuXHRcdFx0bnVtYmVyID0gbnVsbDtcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRudW1iZXIgPSB1dGlscy5wYXJzZUludChudW1iZXIpO1xyXG5cdFx0XHRpZiAobnVtYmVyID09IG51bGwpXHJcblx0XHRcdFx0JG51bWJlci5hZGRDbGFzcyhcImVycm9yXCIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBvYmplY3RzQ291bnRHZSA9ICRvYmplY3RzQ291bnRHZS52YWwoKTtcclxuXHRcdGlmICghb2JqZWN0c0NvdW50R2UpXHJcblx0XHRcdG9iamVjdHNDb3VudEdlID0gbnVsbDtcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRvYmplY3RzQ291bnRHZSA9IHV0aWxzLnBhcnNlSW50KG9iamVjdHNDb3VudEdlKTtcclxuXHRcdFx0aWYgKG9iamVjdHNDb3VudEdlID09IG51bGwpXHJcblx0XHRcdFx0JG9iamVjdHNDb3VudEdlLmFkZENsYXNzKFwiZXJyb3JcIik7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGFwYXJ0bWVudHNDb3VudEdlID0gJGFwYXJ0bWVudHNDb3VudEdlLnZhbCgpO1xyXG5cdFx0aWYgKCFhcGFydG1lbnRzQ291bnRHZSlcclxuXHRcdFx0YXBhcnRtZW50c0NvdW50R2UgPSBudWxsO1xyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGFwYXJ0bWVudHNDb3VudEdlID0gdXRpbHMucGFyc2VJbnQoYXBhcnRtZW50c0NvdW50R2UpO1xyXG5cdFx0XHRpZiAoYXBhcnRtZW50c0NvdW50R2UgPT0gbnVsbClcclxuXHRcdFx0XHQkYXBhcnRtZW50c0NvdW50R2UuYWRkQ2xhc3MoXCJlcnJvclwiKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXJlY29yZFR5cGUgJiYgcmVjb3JkTnVtYmVyID09IG51bGwgJiYgIXJlY29yZFRleHQgJiYgIWRhdGVGcm9tICYmICFkYXRlVG8gJiYgIXBlcnNvbiAmJiBudW1iZXIgPT0gbnVsbCAmJiBvYmplY3RzQ291bnRHZSA9PSBudWxsICYmIGFwYXJ0bWVudHNDb3VudEdlID09IG51bGwpIHJldHVybiBudWxsO1xyXG5cdFx0cmV0dXJuIHsgcmVjb3JkVHlwZSwgcmVjb3JkTnVtYmVyLCByZWNvcmRUZXh0LCBkYXRlRnJvbSwgZGF0ZVRvLCBwZXJzb24sIG51bWJlciwgb2JqZWN0c0NvdW50R2UsIGFwYXJ0bWVudHNDb3VudEdlIH07XHJcblx0fVxyXG5cdF9zaG93U2VhcmNoU3RhdHMob2JqZWN0SWRzIC8qIDogW10gKi8sIHJlY29yZElkcyAvKiA6IHt9ICovKSB7XHJcblx0XHR2YXIgb2JqZWN0c0NvdW50ID0gb2JqZWN0SWRzLmxlbmd0aDtcclxuXHJcblx0XHR2YXIgYXBhcnRtZW50c0NvdW50ID0gMDtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0SWRzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHZhciBvYmogPSB0aGlzLl9tb2RlbC5nZXRPYmplY3RCeUlkKG9iamVjdElkc1tpXSk7XHJcblx0XHRcdGlmIChvYmogaW5zdGFuY2VvZiBtLkFwYXJ0bWVudClcclxuXHRcdFx0XHRhcGFydG1lbnRzQ291bnQrKztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcmVjb3Jkc0NvdW50ID0gMDtcclxuXHRcdGZvciAodmFyIGlkIGluIHJlY29yZElkcylcclxuXHRcdCAgICBpZiAocmVjb3JkSWRzLmhhc093blByb3BlcnR5KGlkKSlcclxuXHRcdCAgICAgICAgcmVjb3Jkc0NvdW50Kys7XHJcblxyXG5cdFx0dmFyICRlbCA9IHRoaXMuJGVsZW1lbnQoKTtcclxuXHRcdHZhciAkZm91bmRPYmplY3RzQ291bnQgPSAkZWwuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfZm91bmRPYmplY3RzQ291bnRcIik7XHJcblx0XHR2YXIgJGZvdW5kQXBhcnRtZW50c0NvdW50ID0gJGVsLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX2ZvdW5kQXBhcnRtZW50c0NvdW50XCIpO1xyXG5cdFx0dmFyICRmb3VuZFJlY29yZHNDb3VudCA9ICRlbC5maW5kKFwiI1wiICsgdGhpcy51aWQgKyBcIl9mb3VuZFJlY29yZHNDb3VudFwiKTtcclxuXHRcdCRmb3VuZE9iamVjdHNDb3VudC50ZXh0KG9iamVjdHNDb3VudCArIFwiIFwiICsgdXRpbHMucGx1cmFsKG9iamVjdHNDb3VudCwgW1wi0L7QsdGK0LXQutGCXCIsIFwi0L7QsdGK0LXQutGC0LBcIiwgXCLQvtCx0YrQtdC60YLQvtCyXCJdKSk7XHJcblx0XHQkZm91bmRBcGFydG1lbnRzQ291bnQudGV4dChhcGFydG1lbnRzQ291bnQgKyBcIiBcIiArIHV0aWxzLnBsdXJhbChhcGFydG1lbnRzQ291bnQsIFtcItC60LLQsNGA0YLQuNGA0LBcIiwgXCLQutCy0LDRgNGC0LjRgNGLXCIsIFwi0LrQstCw0YDRgtC40YBcIl0pKTtcclxuXHRcdCRmb3VuZFJlY29yZHNDb3VudC50ZXh0KHJlY29yZHNDb3VudCArIFwiIFwiICsgdXRpbHMucGx1cmFsKHJlY29yZHNDb3VudCwgW1wi0LfQsNC/0LjRgdC4XCIsIFwi0LfQsNC/0LjRgdGP0YVcIiwgXCLQt9Cw0L/QuNGB0Y/RhVwiXSkpO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWFyY2hWaWV3O1xyXG5cclxudmFyIG0gPSByZXF1aXJlKFwiYXBwL21vZGVsL01vZGVsQ2xhc3Nlc1wiKTtcclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxudmFyIEdyaWRWaWV3ID0gcmVxdWlyZShcImFwcC92aWV3cy9HcmlkVmlld1wiKTtcclxuIiwidmFyIFZpZXcgPSByZXF1aXJlKFwiYXBwL3ZpZXdzL1ZpZXdcIik7XHJcblxyXG52YXIgRXhhbXBsZSA9IGBcclxuU0VMRUNUIHIuc291cmNlXHJcbkZST00gQXBhcnRtZW50IGFcclxuSk9JTiBSZWNvcmQgciBPTiByLmlkID0gYS5yZWNvcmRJZFxyXG5XSEVSRSBhLm51bWJlciA9IDFcclxuYC50cmltKCk7XHJcblxyXG5jbGFzcyBTcWxWaWV3IGV4dGVuZHMgVmlldyB7XHJcblx0Y29uc3RydWN0b3Ioc3FsTW9kZWwpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLl9zcWxNb2RlbCA9IHNxbE1vZGVsO1xyXG5cdH1cclxuXHRnZXRIdG1sKCkge1xyXG5cdFx0cmV0dXJuIGBcclxuXHRcdFx0PGRpdiBpZD1cIiR7dGhpcy51aWR9XCIgY2xhc3M9XCJzcWx2aWV3XCI+XHJcblx0XHRcdFx0PGRpdiBjbGFzcz1cInNxbHZpZXdfd3JhcHBlclwiPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzcz1cInNxbHZpZXdfY29udHJvbHNcIj5cclxuXHRcdFx0XHRcdFx0PHRleHRhcmVhIGNvbHM9XCI0MFwiIHJvd3M9XCIyMFwiPjwvdGV4dGFyZWE+PGJyLz5cclxuXHRcdFx0XHRcdFx0PGJ1dHRvbiBpZD1cIiR7dGhpcy51aWQgKyBcIl9leGFtcGxlXCJ9XCIgY2xhc3M9XCJzcWx2aWV3X2J0bkV4YW1wbGVcIj7Qn9GA0LjQvNC10YA8L2J1dHRvbj5cclxuXHRcdFx0XHRcdFx0PGJ1dHRvbiBpZD1cIiR7dGhpcy51aWQgKyBcIl9xdWVyeVwifVwiPtCS0YvQv9C+0LvQvdC40YLRjDwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwic3Fsdmlld19zY2hlbWFcIj5cclxuXHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cImNhcHRpb25cIj7QodGF0LXQvNCwOjwvZGl2PlxyXG5cdFx0XHRcdFx0XHQ8cHJlPiR7dXRpbHMuaHRtbEVuY29kZShTcWxNb2RlbC5TY2hlbWEpfTwvcHJlPlxyXG5cdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0PGRpdiBpZD1cIiR7dGhpcy51aWQgKyBcIl9tZXNzYWdlc1wifVwiIGNsYXNzPVwic3Fsdmlld19tZXNzYWdlc1wiPjwvZGl2PlxyXG5cdFx0XHRcdDxkaXYgaWQ9XCIke3RoaXMudWlkICsgXCJfcmVzdWx0c1wifVwiPjwvZGl2PlxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdGA7XHJcblx0fVxyXG5cdG9uSW5zdGFsbGVkKCkge1xyXG5cdFx0c3VwZXIub25JbnN0YWxsZWQoLi4uYXJndW1lbnRzKTtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3F1ZXJ5XCIpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgc3FsID0gbWUuJGVsZW1lbnQoKS5maW5kKFwidGV4dGFyZWFcIikudmFsKCk7XHJcblx0XHRcdG1lLl9xdWVyeShzcWwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX2V4YW1wbGVcIikuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRcdG1lLiRlbGVtZW50KCkuZmluZChcInRleHRhcmVhXCIpLnZhbChFeGFtcGxlKTtcclxuXHRcdFx0bWUuX3F1ZXJ5KEV4YW1wbGUpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdF9xdWVyeShzcWwpIHtcclxuXHRcdHRoaXMuX2NsZWFyUmVwb3J0KCk7XHJcblx0XHR0aGlzLl9jbGVhclJlc3VsdHMoKTtcclxuXHJcblx0XHRpZiAoc3FsLnRyaW0oKS5sZW5ndGggPT0gMCkge1xyXG5cdFx0XHR0aGlzLl9yZXBvcnRGYWlsdXJlKFwi0JLQstC10LTQuNGC0LUg0LfQsNC/0YDQvtGBXCIpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0dmFyIHJlcyA9IHRoaXMuX3NxbE1vZGVsLnF1ZXJ5KHNxbCk7XHJcblx0XHR9XHJcblx0XHRjYXRjaCAoZXgpIHtcclxuXHRcdFx0dGhpcy5fcmVwb3J0RXJyb3IoZXgpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0aGlzLl9zaG93UmVzdWx0cyhyZXMpO1xyXG5cdH1cclxuXHRfY2xlYXJSZXBvcnQoKSB7XHJcblx0XHR2YXIgJG1lc3NhZ2VzID0gdGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX21lc3NhZ2VzXCIpO1xyXG5cdFx0JG1lc3NhZ2VzLmVtcHR5KCk7XHJcblx0fVxyXG5cdF9yZXBvcnRGYWlsdXJlKG1lc3NhZ2UpIHtcclxuXHRcdHZhciAkbWVzc2FnZXMgPSB0aGlzLiRlbGVtZW50KCkuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfbWVzc2FnZXNcIik7XHJcblx0XHQkbWVzc2FnZXMudGV4dChtZXNzYWdlKTtcclxuXHR9XHJcblx0X3JlcG9ydEVycm9yKGV4KSB7XHJcblx0XHR0aGlzLl9yZXBvcnRGYWlsdXJlKGV4Lm1lc3NhZ2UpO1xyXG5cdH1cclxuXHRfY2xlYXJSZXN1bHRzKCkge1xyXG5cdFx0dmFyICRyZXN1bHRzID0gdGhpcy4kZWxlbWVudCgpLmZpbmQoXCIjXCIgKyB0aGlzLnVpZCArIFwiX3Jlc3VsdHNcIik7XHJcblx0XHQkcmVzdWx0cy5lbXB0eSgpO1xyXG5cdH1cclxuXHRfc2hvd1Jlc3VsdHMoZGF0YXNldHMpIHtcclxuXHRcdHZhciAkcmVzdWx0cyA9IHRoaXMuJGVsZW1lbnQoKS5maW5kKFwiI1wiICsgdGhpcy51aWQgKyBcIl9yZXN1bHRzXCIpO1xyXG5cdFx0dmFyIGFjYyA9IFtdO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGMgPSBkYXRhc2V0cy5sZW5ndGg7IGkgPCBjOyBpKyspXHJcblx0XHRcdHJlbmRlckRhdGFzZXQoZGF0YXNldHNbaV0sIGFjYyk7XHJcblx0XHQkcmVzdWx0cy5odG1sKGFjYy5qb2luKFwiXCIpKTtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU3FsVmlldztcclxuXHJcbnZhciB1dGlscyA9IHJlcXVpcmUoXCJhcHAvdXRpbHNcIik7XHJcbnZhciBTcWxNb2RlbCA9IHJlcXVpcmUoXCJhcHAvbW9kZWwvU3FsTW9kZWxcIik7XHJcblxyXG5mdW5jdGlvbiByZW5kZXJEYXRhc2V0KGRhdGFzZXQsIGFjYykge1xyXG5cdGlmIChkYXRhc2V0Lmxlbmd0aCA9PSAwKSB7XHJcblx0XHRhY2MucHVzaChcIjx0YWJsZT48dHI+PHRkPjxlbT7QndC10YIg0YDQtdC30YPQu9GM0YLQsNGC0L7QsjwvZW0+PC90ZD48L3RyPjwvZGl2PlwiKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0YWNjLnB1c2goXCI8dGFibGU+XCIpO1xyXG5cdGZvciAodmFyIGkgPSAwLCBjID0gZGF0YXNldC5sZW5ndGg7IGkgPCBjOyBpKyspIHtcclxuXHRcdHZhciByb3cgPSBkYXRhc2V0W2ldO1xyXG5cdFx0YWNjLnB1c2goXCI8dHI+XCIpO1xyXG5cdFx0Zm9yICh2YXIgaiA9IDAsIGNqID0gcm93Lmxlbmd0aDsgaiA8IGNqOyBqKyspIHtcclxuXHRcdFx0YWNjLnB1c2goXCI8dGQ+XCIpO1xyXG5cdFx0XHR2YXIgdmFsdWUgPSByb3dbal07XHJcblx0XHRcdGlmICh2YWx1ZSAhPSBudWxsKVxyXG5cdFx0XHRcdGFjYy5wdXNoKHV0aWxzLmh0bWxFbmNvZGUocm93W2pdLnRvU3RyaW5nKCkpKTtcclxuXHRcdH1cclxuXHR9XHJcblx0YWNjLnB1c2goXCI8L3RhYmxlPlwiKTtcclxufVxyXG4iLCJ2YXIgVmlldyA9IHJlcXVpcmUoXCJhcHAvdmlld3MvVmlld1wiKTtcclxuXHJcbmNsYXNzIFRhYkNvbnRyb2wgZXh0ZW5kcyBWaWV3IHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLl90YWJzID0gW107XHJcblx0XHR0aGlzLl9hY3RpdmVJZCA9IG51bGw7XHJcblx0XHR0aGlzLm9uQWN0aXZlSWRDaGFuZ2VkID0gbmV3IHV0aWxzLkRlbGVnYXRlKCk7XHJcblx0fVxyXG5cdGFkZFRhYihpZCwgdGl0bGUpIHtcclxuXHRcdGlmIChpZCA9PSBudWxsKVxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBudWxsOiBpZFwiKTtcclxuXHRcdHRoaXMuX3RhYnMucHVzaCh7IGlkLCB0aXRsZSB9KTtcclxuXHR9XHJcblx0Ly8gQGdldC9zZXRcclxuXHRhY3RpdmVJZCgvKiBvcHRpb25hbCAqLyB2YWx1ZSkge1xyXG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpXHJcblx0XHRcdHJldHVybiB0aGlzLl9hY3RpdmVJZDtcclxuXHRcdHJldHVybiB0aGlzLl9zZXRBY3RpdmVJZCh2YWx1ZSwgLyogc2lnbmFsID0gKi8gZmFsc2UpO1xyXG5cdH1cclxuXHRfc2V0QWN0aXZlSWQodmFsdWUsIHNpZ25hbCAvKiA9IGZhbHNlICovKSB7XHJcblx0XHRpZiAodGhpcy5fYWN0aXZlSWQgPT0gdmFsdWUpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmICh0aGlzLl9hY3RpdmVJZCAhPSBudWxsKVxyXG5cdFx0XHR0aGlzLiRlbGVtZW50KCkuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfdGFiLVwiICsgdGhpcy5fYWN0aXZlSWQpLnJlbW92ZUNsYXNzKFwidGFiY29udHJvbF90YWJfX2FjdGl2ZVwiKTtcclxuXHRcdHRoaXMuX2FjdGl2ZUlkID0gdmFsdWU7XHJcblx0XHR0aGlzLiRlbGVtZW50KCkuZmluZChcIiNcIiArIHRoaXMudWlkICsgXCJfdGFiLVwiICsgdGhpcy5fYWN0aXZlSWQpLmFkZENsYXNzKFwidGFiY29udHJvbF90YWJfX2FjdGl2ZVwiKTtcclxuXHRcdGlmIChzaWduYWwpXHJcblx0XHRcdHRoaXMub25BY3RpdmVJZENoYW5nZWQudHJpZ2dlcigpO1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cdGdldEh0bWwoKSB7XHJcblx0XHRyZXR1cm4gYFxyXG5cdFx0XHQ8ZGl2IGlkPVwiJHt0aGlzLnVpZH1cIiBjbGFzcz1cInRhYmNvbnRyb2xcIj5cclxuXHRcdFx0XHQke3RoaXMuX3RhYnMubWFwKHRhYiA9PiBgPHNwYW5cclxuXHRcdFx0XHRcdGNsYXNzPVwidGFiY29udHJvbF90YWIgJHt0YWIuaWQgPT0gdGhpcy5fYWN0aXZlSWQgPyBcInRhYmNvbnRyb2xfdGFiX19hY3RpdmVcIiA6IFwiXCJ9XCJcclxuXHRcdFx0XHRcdGlkPVwiJHt0aGlzLnVpZCArIFwiX3RhYi1cIiArIHRhYi5pZH1cIj5cclxuXHRcdFx0XHRcdCR7dXRpbHMuaHRtbEVuY29kZSh0YWIudGl0bGUpfVxyXG5cdFx0XHRcdDwvc3Bhbj5gKS5qb2luKFwiXCIpfVxyXG5cdFx0XHQ8L2Rpdj5cclxuXHRcdGA7XHJcblx0fVxyXG5cdG9uSW5zdGFsbGVkKCkge1xyXG5cdFx0c3VwZXIub25JbnN0YWxsZWQoLi4uYXJndW1lbnRzKTtcclxuXHRcdHZhciBtZSA9IHRoaXM7XHJcblxyXG5cdFx0bWUuJGVsZW1lbnQoKS5jaGlsZHJlbigpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgcHJlZml4ID0gbWUudWlkICsgXCJfdGFiLVwiO1xyXG5cdFx0XHRpZiAodGhpcy5pZCAmJiB0aGlzLmlkLnN0YXJ0c1dpdGgocHJlZml4KSkge1xyXG5cdFx0XHRcdHZhciBpZCA9IHRoaXMuaWQuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xyXG5cdFx0XHRcdG1lLl9zZXRBY3RpdmVJZChpZCwgLyogc2lnbmFsID0gKi8gdHJ1ZSk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBUYWJDb250cm9sO1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBWaWV3O1xyXG5cclxudmFyIHV0aWxzID0gcmVxdWlyZShcImFwcC91dGlsc1wiKTtcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5mdW5jdGlvbiBWaWV3KCkge1xyXG5cdHRoaXMudmlzaWJsZSA9IHRydWU7XHJcblx0dGhpcy51aWQgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIi1cIiArIChWaWV3LmNvdW50ZXIrKyk7XHJcblxyXG5cdHRoaXMuX3BhcmVudCA9IG51bGw7XHJcblx0dGhpcy5jaGlsZHJlbiA9IFtdO1xyXG5cclxuXHQvLyBkZWxlZ2F0ZXNcclxuXHR0aGlzLm9uRGVzdHJveSA9IG5ldyB1dGlscy5EZWxlZ2F0ZSgpO1xyXG5cclxuXHRWaWV3LnZpZXdzW3RoaXMudWlkXSA9IHRoaXM7XHJcbn1cclxuXHJcbi8vIEBzdGF0aWNcclxuVmlldy5jb3VudGVyID0gMTtcclxuXHJcbi8vIEBzdGF0aWNcclxuVmlldy52aWV3cyA9IHt9O1xyXG5cclxuVmlldy5wcm90b3R5cGUuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xyXG5cdGlmIChjaGlsZC5fcGFyZW50KVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiY2hhbmdpbmcgcGFyZW50IGN1cnJlbnRseSBub3Qgc3VwcG9ydGVkXCIpO1xyXG5cdHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZCk7XHJcblx0Y2hpbGQuX3BhcmVudCA9IHRoaXM7XHJcblx0Ly8gZm9yIGNvbnZlbmllbmNlXHJcblx0cmV0dXJuIGNoaWxkO1xyXG59O1xyXG5cclxuVmlldy5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uKCRwYXJlbnQpIHtcclxuXHR2YXIgZWxlbWVudCA9IHV0aWxzLmNyZWF0ZUZyb21IdG1sKHRoaXMuZ2V0SHRtbCgpKTtcclxuXHQkcGFyZW50LmFwcGVuZChlbGVtZW50KTtcclxuXHR0aGlzLm9uSW5zdGFsbGVkKCQoZWxlbWVudCksICRwYXJlbnQpO1xyXG59O1xyXG5cclxuVmlldy5wcm90b3R5cGUub25JbnN0YWxsZWQgPSBmdW5jdGlvbigvKiBvcHRpb25hbCAqLyAkZWxlbWVudCwgLyogb3B0aW9uYWwgKi8gJGNvbnRhaW5lcikge1xyXG5cdGlmICgkZWxlbWVudCkge1xyXG5cdFx0dGhpcy5fJGVsZW1lbnQgPSAkZWxlbWVudDtcclxuXHR9XHJcblx0ZWxzZSB7XHJcblx0XHQkZWxlbWVudCA9ICQoXCIjXCIgKyB0aGlzLnVpZCwgJGNvbnRhaW5lcik7XHJcblx0XHRpZiAoISRlbGVtZW50Lmxlbmd0aClcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0dGhpcy5fJGVsZW1lbnQgPSAkZWxlbWVudDtcclxuXHR9XHJcblxyXG5cdGlmICghdGhpcy52aXNpYmxlKVxyXG5cdFx0dGhpcy5fJGVsZW1lbnRbMF0uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG5cclxuXHQvLyB3aGVuIGEgdmlldyBpcyBpbnN0YWxsZWQsIHVzdWFsbHkgaXRzIGNoaWxkcmVuIGFyZSBhbHNvIGluc3RhbGxlZFxyXG5cdHZhciBjaGlsZHJlbiA9IHV0aWxzLkFycmF5cy5jbG9uZSh0aGlzLmNoaWxkcmVuKTtcclxuXHRmb3IgKHZhciBpID0gMCwgYyA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGM7IGkrKylcclxuXHRcdGNoaWxkcmVuW2ldLm9uSW5zdGFsbGVkKHVuZGVmaW5lZCwgdGhpcy5fJGVsZW1lbnQpO1xyXG59O1xyXG5cclxuVmlldy5wcm90b3R5cGUuJGVsZW1lbnQgPSBmdW5jdGlvbigpIHtcclxuXHRyZXR1cm4gdGhpcy5fJGVsZW1lbnQgfHwgJChbXSk7XHJcbn07XHJcblxyXG5WaWV3LnByb3RvdHlwZS5nZXRIdG1sID0gZnVuY3Rpb24oKSB7XHJcblx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkIGluIFwiICsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKTtcclxufTtcclxuXHJcblZpZXcucHJvdG90eXBlLnJlZHJhdyA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciAkZWwgPSB0aGlzLiRlbGVtZW50KCk7XHJcblx0aWYgKCRlbC5sZW5ndGgpIHtcclxuXHRcdHZhciBlbCA9IHV0aWxzLmNyZWF0ZUZyb21IdG1sKHRoaXMuZ2V0SHRtbCgpKTtcclxuXHRcdCRlbC5yZXBsYWNlV2l0aChlbCk7XHJcblx0XHR0aGlzLm9uSW5zdGFsbGVkKCQoZWwpKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKlxyXG5EZXN0cm95IHRoZSB2aWV3IGFuZCBpdHMgY2hpbGRyZW4gcmVjdXJzaXZlbHksIHJlbW92ZSBhbGwgaGFuZGxlcnMuXHJcblRoaXMgbWV0aG9kIGRvZXMgbm90IGFmZmVjdCB2aWV3J3MgcGFyZW50IGFuZCBhbmNlc3RvcnMuXHJcblxyXG5UaGUgY2FsbGVyIGlzIHJlc3BvbnNpYmxlIHRvOlxyXG4gIC0gcmVtb3ZlIHRoZSB2aWV3IGZyb20gcGFyZW50J3MgY2hpbGRyZW4gYXJyYXlcclxuXHQodXNlIGBfcmVtb3ZlQ2hpbGRgIGhlbHBlciBmdW5jdGlvbilcclxuICAtIHJlbW92ZSB2aWV3J3MgJGVsZW1lbnQgZnJvbSBET01cclxuKi9cclxuVmlldy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdGZvciAodmFyIGkgPSAwLCBjID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkgPCBjOyBpKyspXHJcblx0XHR0aGlzLmNoaWxkcmVuW2ldLmRlc3Ryb3koKTtcclxuXHR0aGlzLmNoaWxkcmVuLmxlbmd0aCA9IDA7XHJcblxyXG5cdHRoaXMub25EZXN0cm95LnRyaWdnZXIoKTtcclxuXHJcblx0Ly8gcHJldmVudCBsZWFrc1xyXG5cdHRoaXMuX3BhcmVudCA9IG51bGw7XHJcblx0dGhpcy5vbkRlc3Ryb3kgPSBudWxsO1xyXG5cclxuXHQvLyByZW1vdmUgZnJvbSBnbG9iYWwgY29sbGVjdGlvblxyXG5cdGRlbGV0ZSBWaWV3LnZpZXdzW3RoaXMudWlkXTtcclxufTtcclxuXHJcbi8vIEBzdGF0aWNcclxuVmlldy5fcmVtb3ZlQ2hpbGQgPSBmdW5jdGlvbihwYXJlbnQsIGNoaWxkKSB7XHJcblx0aWYgKHBhcmVudCA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBpcyBudWxsOiBwYXJlbnRcIik7XHJcblx0aWYgKGNoaWxkID09IG51bGwpIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IGlzIG51bGw6IGNoaWxkXCIpO1xyXG5cdHZhciBwb3MgPSBwYXJlbnQuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCk7XHJcblx0aWYgKHBvcyA8IDApXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgZmluZCBjaGlsZCB2aWV3IHRvIHJlbW92ZVwiLCBcInBhcmVudFwiLCBwYXJlbnQudWlkLCBcImNoaWxkXCIsIGNoaWxkLnVpZCk7XHJcblx0ZWxzZVxyXG5cdFx0cGFyZW50LmNoaWxkcmVuLnNwbGljZShwb3MsIDEpO1xyXG59O1xyXG5cclxuLy8gUFJPUFNcclxuXHJcblZpZXcucHJvdG90eXBlLnNldFZpc2libGUgPSBmdW5jdGlvbih2aXNpYmxlKSB7XHJcblx0dGhpcy52aXNpYmxlID0gdmlzaWJsZTtcclxuXHJcblx0aWYgKHRoaXMuXyRlbGVtZW50KSB7XHJcblx0XHRpZiAodGhpcy52aXNpYmxlKVxyXG5cdFx0XHR0aGlzLl8kZWxlbWVudFswXS5zdHlsZS5yZW1vdmVQcm9wZXJ0eShcImRpc3BsYXlcIik7XHJcblx0XHRlbHNlXHJcblx0XHRcdHRoaXMuXyRlbGVtZW50WzBdLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuXHR9XHJcbn07XHJcblxyXG5WaWV3LnByb3RvdHlwZS50b2dnbGVWaXNpYmxlID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIHRoaXMuc2V0VmlzaWJsZSghdGhpcy52aXNpYmxlKTtcclxufTtcclxuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjEwLjBcbnZhciBQYXJzZXIsIFN0cmluZ0RlY29kZXIsIHN0cmVhbSwgdXRpbDtcblxuc3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJyk7XG5cbnV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cblN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2RlcicpLlN0cmluZ0RlY29kZXI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBjYWxsYmFjaywgY2FsbGVkLCBjaHVua3MsIGRhdGEsIG9wdGlvbnMsIHBhcnNlcjtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICBkYXRhID0gYXJndW1lbnRzWzBdO1xuICAgIG9wdGlvbnMgPSBhcmd1bWVudHNbMV07XG4gICAgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl07XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgRXJyb3IoXCJJbnZhbGlkIGNhbGxiYWNrIGFyZ3VtZW50OiBcIiArIChKU09OLnN0cmluZ2lmeShjYWxsYmFjaykpKTtcbiAgICB9XG4gICAgaWYgKCEodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnIHx8IEJ1ZmZlci5pc0J1ZmZlcihhcmd1bWVudHNbMF0pKSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKEVycm9yKFwiSW52YWxpZCBkYXRhIGFyZ3VtZW50OiBcIiArIChKU09OLnN0cmluZ2lmeShkYXRhKSkpKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzBdID09PSAnc3RyaW5nJyB8fCBCdWZmZXIuaXNCdWZmZXIoYXJndW1lbnRzWzBdKSkge1xuICAgICAgZGF0YSA9IGFyZ3VtZW50c1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IGFyZ3VtZW50c1swXTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gYXJndW1lbnRzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gYXJndW1lbnRzWzFdO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gYXJndW1lbnRzWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gYXJndW1lbnRzWzBdO1xuICAgIH1cbiAgfVxuICBpZiAob3B0aW9ucyA9PSBudWxsKSB7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG4gIHBhcnNlciA9IG5ldyBQYXJzZXIob3B0aW9ucyk7XG4gIGlmIChkYXRhICE9IG51bGwpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgcGFyc2VyLndyaXRlKGRhdGEpO1xuICAgICAgcmV0dXJuIHBhcnNlci5lbmQoKTtcbiAgICB9KTtcbiAgfVxuICBpZiAoY2FsbGJhY2spIHtcbiAgICBjYWxsZWQgPSBmYWxzZTtcbiAgICBjaHVua3MgPSBvcHRpb25zLm9iam5hbWUgPyB7fSA6IFtdO1xuICAgIHBhcnNlci5vbigncmVhZGFibGUnLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjaHVuaywgcmVzdWx0cztcbiAgICAgIHJlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChjaHVuayA9IHBhcnNlci5yZWFkKCkpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMub2JqbmFtZSkge1xuICAgICAgICAgIHJlc3VsdHMucHVzaChjaHVua3NbY2h1bmtbMF1dID0gY2h1bmtbMV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMucHVzaChjaHVua3MucHVzaChjaHVuaykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9KTtcbiAgICBwYXJzZXIub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gICAgcGFyc2VyLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBjaHVua3MpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBwYXJzZXI7XG59O1xuXG5QYXJzZXIgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHZhciBiYXNlLCBiYXNlMSwgYmFzZTEwLCBiYXNlMTEsIGJhc2UxMiwgYmFzZTEzLCBiYXNlMTQsIGJhc2UxNSwgYmFzZTE2LCBiYXNlMiwgYmFzZTMsIGJhc2U0LCBiYXNlNSwgYmFzZTYsIGJhc2U3LCBiYXNlOCwgYmFzZTksIGssIHY7XG4gIGlmIChvcHRpb25zID09IG51bGwpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cbiAgb3B0aW9ucy5vYmplY3RNb2RlID0gdHJ1ZTtcbiAgdGhpcy5vcHRpb25zID0ge307XG4gIGZvciAoayBpbiBvcHRpb25zKSB7XG4gICAgdiA9IG9wdGlvbnNba107XG4gICAgdGhpcy5vcHRpb25zW2tdID0gdjtcbiAgfVxuICBzdHJlYW0uVHJhbnNmb3JtLmNhbGwodGhpcywgdGhpcy5vcHRpb25zKTtcbiAgaWYgKChiYXNlID0gdGhpcy5vcHRpb25zKS5yb3dEZWxpbWl0ZXIgPT0gbnVsbCkge1xuICAgIGJhc2Uucm93RGVsaW1pdGVyID0gbnVsbDtcbiAgfVxuICBpZiAoKGJhc2UxID0gdGhpcy5vcHRpb25zKS5kZWxpbWl0ZXIgPT0gbnVsbCkge1xuICAgIGJhc2UxLmRlbGltaXRlciA9ICcsJztcbiAgfVxuICBpZiAoKGJhc2UyID0gdGhpcy5vcHRpb25zKS5xdW90ZSA9PSBudWxsKSB7XG4gICAgYmFzZTIucXVvdGUgPSAnXCInO1xuICB9XG4gIGlmICgoYmFzZTMgPSB0aGlzLm9wdGlvbnMpLmVzY2FwZSA9PSBudWxsKSB7XG4gICAgYmFzZTMuZXNjYXBlID0gJ1wiJztcbiAgfVxuICBpZiAoKGJhc2U0ID0gdGhpcy5vcHRpb25zKS5jb2x1bW5zID09IG51bGwpIHtcbiAgICBiYXNlNC5jb2x1bW5zID0gbnVsbDtcbiAgfVxuICBpZiAoKGJhc2U1ID0gdGhpcy5vcHRpb25zKS5jb21tZW50ID09IG51bGwpIHtcbiAgICBiYXNlNS5jb21tZW50ID0gJyc7XG4gIH1cbiAgaWYgKChiYXNlNiA9IHRoaXMub3B0aW9ucykub2JqbmFtZSA9PSBudWxsKSB7XG4gICAgYmFzZTYub2JqbmFtZSA9IGZhbHNlO1xuICB9XG4gIGlmICgoYmFzZTcgPSB0aGlzLm9wdGlvbnMpLnRyaW0gPT0gbnVsbCkge1xuICAgIGJhc2U3LnRyaW0gPSBmYWxzZTtcbiAgfVxuICBpZiAoKGJhc2U4ID0gdGhpcy5vcHRpb25zKS5sdHJpbSA9PSBudWxsKSB7XG4gICAgYmFzZTgubHRyaW0gPSBmYWxzZTtcbiAgfVxuICBpZiAoKGJhc2U5ID0gdGhpcy5vcHRpb25zKS5ydHJpbSA9PSBudWxsKSB7XG4gICAgYmFzZTkucnRyaW0gPSBmYWxzZTtcbiAgfVxuICBpZiAoKGJhc2UxMCA9IHRoaXMub3B0aW9ucykuYXV0b19wYXJzZSA9PSBudWxsKSB7XG4gICAgYmFzZTEwLmF1dG9fcGFyc2UgPSBmYWxzZTtcbiAgfVxuICBpZiAoKGJhc2UxMSA9IHRoaXMub3B0aW9ucykuYXV0b19wYXJzZV9kYXRlID09IG51bGwpIHtcbiAgICBiYXNlMTEuYXV0b19wYXJzZV9kYXRlID0gZmFsc2U7XG4gIH1cbiAgaWYgKChiYXNlMTIgPSB0aGlzLm9wdGlvbnMpLnJlbGF4ID09IG51bGwpIHtcbiAgICBiYXNlMTIucmVsYXggPSBmYWxzZTtcbiAgfVxuICBpZiAoKGJhc2UxMyA9IHRoaXMub3B0aW9ucykucmVsYXhfY29sdW1uX2NvdW50ID09IG51bGwpIHtcbiAgICBiYXNlMTMucmVsYXhfY29sdW1uX2NvdW50ID0gZmFsc2U7XG4gIH1cbiAgaWYgKChiYXNlMTQgPSB0aGlzLm9wdGlvbnMpLnNraXBfZW1wdHlfbGluZXMgPT0gbnVsbCkge1xuICAgIGJhc2UxNC5za2lwX2VtcHR5X2xpbmVzID0gZmFsc2U7XG4gIH1cbiAgaWYgKChiYXNlMTUgPSB0aGlzLm9wdGlvbnMpLm1heF9saW1pdF9vbl9kYXRhX3JlYWQgPT0gbnVsbCkge1xuICAgIGJhc2UxNS5tYXhfbGltaXRfb25fZGF0YV9yZWFkID0gMTI4MDAwO1xuICB9XG4gIGlmICgoYmFzZTE2ID0gdGhpcy5vcHRpb25zKS5za2lwX2xpbmVzX3dpdGhfZW1wdHlfdmFsdWVzID09IG51bGwpIHtcbiAgICBiYXNlMTYuc2tpcF9saW5lc193aXRoX2VtcHR5X3ZhbHVlcyA9IGZhbHNlO1xuICB9XG4gIHRoaXMubGluZXMgPSAwO1xuICB0aGlzLmNvdW50ID0gMDtcbiAgdGhpcy5za2lwcGVkX2xpbmVfY291bnQgPSAwO1xuICB0aGlzLmVtcHR5X2xpbmVfY291bnQgPSAwO1xuICB0aGlzLmlzX2ludCA9IC9eKFxcLXxcXCspPyhbMS05XStbMC05XSopJC87XG4gIHRoaXMuaXNfZmxvYXQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiAodmFsdWUgLSBwYXJzZUZsb2F0KHZhbHVlKSArIDEpID49IDA7XG4gIH07XG4gIHRoaXMuZGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKCk7XG4gIHRoaXMuYnVmID0gJyc7XG4gIHRoaXMucXVvdGluZyA9IGZhbHNlO1xuICB0aGlzLmNvbW1lbnRpbmcgPSBmYWxzZTtcbiAgdGhpcy5maWVsZCA9ICcnO1xuICB0aGlzLm5leHRDaGFyID0gbnVsbDtcbiAgdGhpcy5jbG9zaW5nUXVvdGUgPSAwO1xuICB0aGlzLmxpbmUgPSBbXTtcbiAgdGhpcy5jaHVua3MgPSBbXTtcbiAgdGhpcy5yYXdCdWYgPSAnJztcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG51dGlsLmluaGVyaXRzKFBhcnNlciwgc3RyZWFtLlRyYW5zZm9ybSk7XG5cbm1vZHVsZS5leHBvcnRzLlBhcnNlciA9IFBhcnNlcjtcblxuUGFyc2VyLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYWxsYmFjaykge1xuICB2YXIgZXJyLCBlcnJvcjtcbiAgaWYgKGNodW5rIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgY2h1bmsgPSB0aGlzLmRlY29kZXIud3JpdGUoY2h1bmspO1xuICB9XG4gIHRyeSB7XG4gICAgdGhpcy5fX3dyaXRlKGNodW5rLCBmYWxzZSk7XG4gICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgZXJyID0gZXJyb3I7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLl9mbHVzaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHZhciBlcnIsIGVycm9yO1xuICB0cnkge1xuICAgIHRoaXMuX193cml0ZSh0aGlzLmRlY29kZXIuZW5kKCksIHRydWUpO1xuICAgIGlmICh0aGlzLnF1b3RpbmcpIHtcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoXCJRdW90ZWQgZmllbGQgbm90IHRlcm1pbmF0ZWQgYXQgbGluZSBcIiArICh0aGlzLmxpbmVzICsgMSkpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMubGluZS5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9fcHVzaCh0aGlzLmxpbmUpO1xuICAgIH1cbiAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBlcnIgPSBlcnJvcjtcbiAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUuX19wdXNoID0gZnVuY3Rpb24obGluZSkge1xuICB2YXIgZmllbGQsIGksIGosIGxlbiwgbGluZUFzQ29sdW1ucywgcmF3QnVmLCByb3c7XG4gIGlmICh0aGlzLm9wdGlvbnMuc2tpcF9saW5lc193aXRoX2VtcHR5X3ZhbHVlcyAmJiBsaW5lLmpvaW4oJycpLnRyaW0oKSA9PT0gJycpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcm93ID0gbnVsbDtcbiAgaWYgKHRoaXMub3B0aW9ucy5jb2x1bW5zID09PSB0cnVlKSB7XG4gICAgdGhpcy5vcHRpb25zLmNvbHVtbnMgPSBsaW5lO1xuICAgIHJhd0J1ZiA9ICcnO1xuICAgIHJldHVybjtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLmNvbHVtbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9wdGlvbnMuY29sdW1ucyA9IHRoaXMub3B0aW9ucy5jb2x1bW5zKGxpbmUpO1xuICAgIHJhd0J1ZiA9ICcnO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMubGluZV9sZW5ndGggJiYgbGluZS5sZW5ndGggPiAwKSB7XG4gICAgdGhpcy5saW5lX2xlbmd0aCA9IHRoaXMub3B0aW9ucy5jb2x1bW5zID8gdGhpcy5vcHRpb25zLmNvbHVtbnMubGVuZ3RoIDogbGluZS5sZW5ndGg7XG4gIH1cbiAgaWYgKGxpbmUubGVuZ3RoID09PSAxICYmIGxpbmVbMF0gPT09ICcnKSB7XG4gICAgdGhpcy5lbXB0eV9saW5lX2NvdW50Kys7XG4gIH0gZWxzZSBpZiAobGluZS5sZW5ndGggIT09IHRoaXMubGluZV9sZW5ndGgpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnJlbGF4X2NvbHVtbl9jb3VudCkge1xuICAgICAgdGhpcy5za2lwcGVkX2xpbmVfY291bnQrKztcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jb2x1bW5zICE9IG51bGwpIHtcbiAgICAgIHRocm93IEVycm9yKFwiTnVtYmVyIG9mIGNvbHVtbnMgb24gbGluZSBcIiArIHRoaXMubGluZXMgKyBcIiBkb2VzIG5vdCBtYXRjaCBoZWFkZXJcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IEVycm9yKFwiTnVtYmVyIG9mIGNvbHVtbnMgaXMgaW5jb25zaXN0ZW50IG9uIGxpbmUgXCIgKyB0aGlzLmxpbmVzKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5jb3VudCsrO1xuICB9XG4gIGlmICh0aGlzLm9wdGlvbnMuY29sdW1ucyAhPSBudWxsKSB7XG4gICAgbGluZUFzQ29sdW1ucyA9IHt9O1xuICAgIGZvciAoaSA9IGogPSAwLCBsZW4gPSBsaW5lLmxlbmd0aDsgaiA8IGxlbjsgaSA9ICsraikge1xuICAgICAgZmllbGQgPSBsaW5lW2ldO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5jb2x1bW5zW2ldID09PSBmYWxzZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGxpbmVBc0NvbHVtbnNbdGhpcy5vcHRpb25zLmNvbHVtbnNbaV1dID0gZmllbGQ7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMub2JqbmFtZSkge1xuICAgICAgcm93ID0gW2xpbmVBc0NvbHVtbnNbdGhpcy5vcHRpb25zLm9iam5hbWVdLCBsaW5lQXNDb2x1bW5zXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcm93ID0gbGluZUFzQ29sdW1ucztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcm93ID0gbGluZTtcbiAgfVxuICBpZiAodGhpcy5vcHRpb25zLnJhdykge1xuICAgIHRoaXMucHVzaCh7XG4gICAgICByYXc6IHRoaXMucmF3QnVmLFxuICAgICAgcm93OiByb3dcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5yYXdCdWYgPSAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5wdXNoKHJvdyk7XG4gIH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUuX193cml0ZSA9IGZ1bmN0aW9uKGNoYXJzLCBlbmQsIGNhbGxiYWNrKSB7XG4gIHZhciBhcmVOZXh0Q2hhcnNEZWxpbWl0ZXIsIGFyZU5leHRDaGFyc1Jvd0RlbGltaXRlcnMsIGF1dG9fcGFyc2UsIGNoYXIsIGVzY2FwZUlzUXVvdGUsIGksIGlzRGVsaW1pdGVyLCBpc0VzY2FwZSwgaXNOZXh0Q2hhckFDb21tZW50LCBpc1F1b3RlLCBpc1Jvd0RlbGltaXRlciwgaXNfZmxvYXQsIGlzX2ludCwgbCwgbHRyaW0sIG5leHRDaGFyUG9zLCByZWYsIHJlbWFpbmluZ0J1ZmZlciwgcmVzdWx0cywgcm93RGVsaW1pdGVyLCByb3dEZWxpbWl0ZXJMZW5ndGgsIHJ0cmltLCB3YXNDb21tZW50aW5nO1xuICBpc19pbnQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh0eXBlb2YgX3RoaXMuaXNfaW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBfdGhpcy5pc19pbnQodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIF90aGlzLmlzX2ludC50ZXN0KHZhbHVlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSh0aGlzKTtcbiAgaXNfZmxvYXQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh0eXBlb2YgX3RoaXMuaXNfZmxvYXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzLmlzX2Zsb2F0KHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfdGhpcy5pc19mbG9hdC50ZXN0KHZhbHVlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSh0aGlzKTtcbiAgYXV0b19wYXJzZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIG07XG4gICAgICBpZiAoX3RoaXMub3B0aW9ucy5hdXRvX3BhcnNlICYmIGlzX2ludChfdGhpcy5maWVsZCkpIHtcbiAgICAgICAgX3RoaXMuZmllbGQgPSBwYXJzZUludChfdGhpcy5maWVsZCk7XG4gICAgICB9IGVsc2UgaWYgKF90aGlzLm9wdGlvbnMuYXV0b19wYXJzZSAmJiBpc19mbG9hdChfdGhpcy5maWVsZCkpIHtcbiAgICAgICAgX3RoaXMuZmllbGQgPSBwYXJzZUZsb2F0KF90aGlzLmZpZWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoX3RoaXMub3B0aW9ucy5hdXRvX3BhcnNlICYmIF90aGlzLm9wdGlvbnMuYXV0b19wYXJzZV9kYXRlKSB7XG4gICAgICAgIG0gPSBEYXRlLnBhcnNlKF90aGlzLmZpZWxkKTtcbiAgICAgICAgaWYgKCFpc05hTihtKSkge1xuICAgICAgICAgIF90aGlzLmZpZWxkID0gbmV3IERhdGUobSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBfdGhpcy5maWVsZDtcbiAgICB9O1xuICB9KSh0aGlzKTtcbiAgbHRyaW0gPSB0aGlzLm9wdGlvbnMudHJpbSB8fCB0aGlzLm9wdGlvbnMubHRyaW07XG4gIHJ0cmltID0gdGhpcy5vcHRpb25zLnRyaW0gfHwgdGhpcy5vcHRpb25zLnJ0cmltO1xuICBjaGFycyA9IHRoaXMuYnVmICsgY2hhcnM7XG4gIGwgPSBjaGFycy5sZW5ndGg7XG4gIHJvd0RlbGltaXRlckxlbmd0aCA9IHRoaXMub3B0aW9ucy5yb3dEZWxpbWl0ZXIgPyB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyLmxlbmd0aCA6IDA7XG4gIGkgPSAwO1xuICBpZiAodGhpcy5saW5lcyA9PT0gMCAmJiAweEZFRkYgPT09IGNoYXJzLmNoYXJDb2RlQXQoMCkpIHtcbiAgICBpKys7XG4gIH1cbiAgd2hpbGUgKGkgPCBsKSB7XG4gICAgaWYgKCFlbmQpIHtcbiAgICAgIHJlbWFpbmluZ0J1ZmZlciA9IGNoYXJzLnN1YnN0cihpLCBsIC0gaSk7XG4gICAgICBpZiAoKCF0aGlzLmNvbW1lbnRpbmcgJiYgbCAtIGkgPCB0aGlzLm9wdGlvbnMuY29tbWVudC5sZW5ndGggJiYgdGhpcy5vcHRpb25zLmNvbW1lbnQuc3Vic3RyKDAsIGwgLSBpKSA9PT0gcmVtYWluaW5nQnVmZmVyKSB8fCAodGhpcy5vcHRpb25zLnJvd0RlbGltaXRlciAmJiBsIC0gaSA8IHJvd0RlbGltaXRlckxlbmd0aCAmJiB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyLnN1YnN0cigwLCBsIC0gaSkgPT09IHJlbWFpbmluZ0J1ZmZlcikgfHwgKHRoaXMub3B0aW9ucy5yb3dEZWxpbWl0ZXIgJiYgdGhpcy5xdW90aW5nICYmIGwgLSBpIDwgKHRoaXMub3B0aW9ucy5xdW90ZS5sZW5ndGggKyByb3dEZWxpbWl0ZXJMZW5ndGgpICYmICh0aGlzLm9wdGlvbnMucXVvdGUgKyB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyKS5zdWJzdHIoMCwgbCAtIGkpID09PSByZW1haW5pbmdCdWZmZXIpIHx8IChsIC0gaSA8PSB0aGlzLm9wdGlvbnMuZGVsaW1pdGVyLmxlbmd0aCAmJiB0aGlzLm9wdGlvbnMuZGVsaW1pdGVyLnN1YnN0cigwLCBsIC0gaSkgPT09IHJlbWFpbmluZ0J1ZmZlcikgfHwgKGwgLSBpIDw9IHRoaXMub3B0aW9ucy5lc2NhcGUubGVuZ3RoICYmIHRoaXMub3B0aW9ucy5lc2NhcGUuc3Vic3RyKDAsIGwgLSBpKSA9PT0gcmVtYWluaW5nQnVmZmVyKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgY2hhciA9IHRoaXMubmV4dENoYXIgPyB0aGlzLm5leHRDaGFyIDogY2hhcnMuY2hhckF0KGkpO1xuICAgIHRoaXMubmV4dENoYXIgPSBsID4gaSArIDEgPyBjaGFycy5jaGFyQXQoaSArIDEpIDogJyc7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5yYXcpIHtcbiAgICAgIHRoaXMucmF3QnVmICs9IGNoYXI7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyID09IG51bGwpIHtcbiAgICAgIGlmICgoIXRoaXMucXVvdGluZykgJiYgKGNoYXIgPT09ICdcXG4nIHx8IGNoYXIgPT09ICdcXHInKSkge1xuICAgICAgICByb3dEZWxpbWl0ZXIgPSBjaGFyO1xuICAgICAgICBuZXh0Q2hhclBvcyA9IGkgKyAxO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm5leHRDaGFyID09PSAnXFxuJyB8fCB0aGlzLm5leHRDaGFyID09PSAnXFxyJykge1xuICAgICAgICByb3dEZWxpbWl0ZXIgPSB0aGlzLm5leHRDaGFyO1xuICAgICAgICBuZXh0Q2hhclBvcyA9IGkgKyAyO1xuICAgICAgICBpZiAodGhpcy5yYXcpIHtcbiAgICAgICAgICByYXdCdWYgKz0gdGhpcy5uZXh0Q2hhcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJvd0RlbGltaXRlcikge1xuICAgICAgICBpZiAocm93RGVsaW1pdGVyID09PSAnXFxyJyAmJiBjaGFycy5jaGFyQXQobmV4dENoYXJQb3MpID09PSAnXFxuJykge1xuICAgICAgICAgIHJvd0RlbGltaXRlciArPSAnXFxuJztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyID0gcm93RGVsaW1pdGVyO1xuICAgICAgICByb3dEZWxpbWl0ZXJMZW5ndGggPSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbW1lbnRpbmcgJiYgY2hhciA9PT0gdGhpcy5vcHRpb25zLmVzY2FwZSkge1xuICAgICAgZXNjYXBlSXNRdW90ZSA9IHRoaXMub3B0aW9ucy5lc2NhcGUgPT09IHRoaXMub3B0aW9ucy5xdW90ZTtcbiAgICAgIGlzRXNjYXBlID0gdGhpcy5uZXh0Q2hhciA9PT0gdGhpcy5vcHRpb25zLmVzY2FwZTtcbiAgICAgIGlzUXVvdGUgPSB0aGlzLm5leHRDaGFyID09PSB0aGlzLm9wdGlvbnMucXVvdGU7XG4gICAgICBpZiAoIShlc2NhcGVJc1F1b3RlICYmICF0aGlzLmZpZWxkICYmICF0aGlzLnF1b3RpbmcpICYmIChpc0VzY2FwZSB8fCBpc1F1b3RlKSkge1xuICAgICAgICBpKys7XG4gICAgICAgIGNoYXIgPSB0aGlzLm5leHRDaGFyO1xuICAgICAgICB0aGlzLm5leHRDaGFyID0gY2hhcnMuY2hhckF0KGkgKyAxKTtcbiAgICAgICAgdGhpcy5maWVsZCArPSBjaGFyO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhdykge1xuICAgICAgICAgIHRoaXMucmF3QnVmICs9IGNoYXI7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbW1lbnRpbmcgJiYgY2hhciA9PT0gdGhpcy5vcHRpb25zLnF1b3RlKSB7XG4gICAgICBpZiAodGhpcy5xdW90aW5nKSB7XG4gICAgICAgIGFyZU5leHRDaGFyc1Jvd0RlbGltaXRlcnMgPSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyICYmIGNoYXJzLnN1YnN0cihpICsgMSwgdGhpcy5vcHRpb25zLnJvd0RlbGltaXRlci5sZW5ndGgpID09PSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyO1xuICAgICAgICBhcmVOZXh0Q2hhcnNEZWxpbWl0ZXIgPSBjaGFycy5zdWJzdHIoaSArIDEsIHRoaXMub3B0aW9ucy5kZWxpbWl0ZXIubGVuZ3RoKSA9PT0gdGhpcy5vcHRpb25zLmRlbGltaXRlcjtcbiAgICAgICAgaXNOZXh0Q2hhckFDb21tZW50ID0gdGhpcy5uZXh0Q2hhciA9PT0gdGhpcy5vcHRpb25zLmNvbW1lbnQ7XG4gICAgICAgIGlmICh0aGlzLm5leHRDaGFyICYmICFhcmVOZXh0Q2hhcnNSb3dEZWxpbWl0ZXJzICYmICFhcmVOZXh0Q2hhcnNEZWxpbWl0ZXIgJiYgIWlzTmV4dENoYXJBQ29tbWVudCkge1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmVsYXgpIHtcbiAgICAgICAgICAgIHRoaXMucXVvdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maWVsZCA9IFwiXCIgKyB0aGlzLm9wdGlvbnMucXVvdGUgKyB0aGlzLmZpZWxkO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcIkludmFsaWQgY2xvc2luZyBxdW90ZSBhdCBsaW5lIFwiICsgKHRoaXMubGluZXMgKyAxKSArIFwiOyBmb3VuZCBcIiArIChKU09OLnN0cmluZ2lmeSh0aGlzLm5leHRDaGFyKSkgKyBcIiBpbnN0ZWFkIG9mIGRlbGltaXRlciBcIiArIChKU09OLnN0cmluZ2lmeSh0aGlzLm9wdGlvbnMuZGVsaW1pdGVyKSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnF1b3RpbmcgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmNsb3NpbmdRdW90ZSA9IHRoaXMub3B0aW9ucy5xdW90ZS5sZW5ndGg7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGlmIChlbmQgJiYgaSA9PT0gbCkge1xuICAgICAgICAgICAgdGhpcy5saW5lLnB1c2goYXV0b19wYXJzZSh0aGlzLmZpZWxkKSk7XG4gICAgICAgICAgICB0aGlzLmZpZWxkID0gJyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLmZpZWxkKSB7XG4gICAgICAgIHRoaXMucXVvdGluZyA9IHRydWU7XG4gICAgICAgIGkrKztcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuZmllbGQgJiYgIXRoaXMub3B0aW9ucy5yZWxheCkge1xuICAgICAgICB0aHJvdyBFcnJvcihcIkludmFsaWQgb3BlbmluZyBxdW90ZSBhdCBsaW5lIFwiICsgKHRoaXMubGluZXMgKyAxKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlzUm93RGVsaW1pdGVyID0gdGhpcy5vcHRpb25zLnJvd0RlbGltaXRlciAmJiBjaGFycy5zdWJzdHIoaSwgdGhpcy5vcHRpb25zLnJvd0RlbGltaXRlci5sZW5ndGgpID09PSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyO1xuICAgIGlmIChpc1Jvd0RlbGltaXRlciB8fCAoZW5kICYmIGkgPT09IGwgLSAxKSkge1xuICAgICAgdGhpcy5saW5lcysrO1xuICAgIH1cbiAgICB3YXNDb21tZW50aW5nID0gZmFsc2U7XG4gICAgaWYgKCF0aGlzLmNvbW1lbnRpbmcgJiYgIXRoaXMucXVvdGluZyAmJiB0aGlzLm9wdGlvbnMuY29tbWVudCAmJiBjaGFycy5zdWJzdHIoaSwgdGhpcy5vcHRpb25zLmNvbW1lbnQubGVuZ3RoKSA9PT0gdGhpcy5vcHRpb25zLmNvbW1lbnQpIHtcbiAgICAgIHRoaXMuY29tbWVudGluZyA9IHRydWU7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNvbW1lbnRpbmcgJiYgaXNSb3dEZWxpbWl0ZXIpIHtcbiAgICAgIHdhc0NvbW1lbnRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5jb21tZW50aW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGlzRGVsaW1pdGVyID0gY2hhcnMuc3Vic3RyKGksIHRoaXMub3B0aW9ucy5kZWxpbWl0ZXIubGVuZ3RoKSA9PT0gdGhpcy5vcHRpb25zLmRlbGltaXRlcjtcbiAgICBpZiAoIXRoaXMuY29tbWVudGluZyAmJiAhdGhpcy5xdW90aW5nICYmIChpc0RlbGltaXRlciB8fCBpc1Jvd0RlbGltaXRlcikpIHtcbiAgICAgIGlmIChpc1Jvd0RlbGltaXRlciAmJiB0aGlzLmxpbmUubGVuZ3RoID09PSAwICYmIHRoaXMuZmllbGQgPT09ICcnKSB7XG4gICAgICAgIGlmICh3YXNDb21tZW50aW5nIHx8IHRoaXMub3B0aW9ucy5za2lwX2VtcHR5X2xpbmVzKSB7XG4gICAgICAgICAgaSArPSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLm5leHRDaGFyID0gY2hhcnMuY2hhckF0KGkpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocnRyaW0pIHtcbiAgICAgICAgaWYgKCF0aGlzLmNsb3NpbmdRdW90ZSkge1xuICAgICAgICAgIHRoaXMuZmllbGQgPSB0aGlzLmZpZWxkLnRyaW1SaWdodCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmxpbmUucHVzaChhdXRvX3BhcnNlKHRoaXMuZmllbGQpKTtcbiAgICAgIHRoaXMuY2xvc2luZ1F1b3RlID0gMDtcbiAgICAgIHRoaXMuZmllbGQgPSAnJztcbiAgICAgIGlmIChpc0RlbGltaXRlcikge1xuICAgICAgICBpICs9IHRoaXMub3B0aW9ucy5kZWxpbWl0ZXIubGVuZ3RoO1xuICAgICAgICB0aGlzLm5leHRDaGFyID0gY2hhcnMuY2hhckF0KGkpO1xuICAgICAgICBpZiAoZW5kICYmICF0aGlzLm5leHRDaGFyKSB7XG4gICAgICAgICAgaXNSb3dEZWxpbWl0ZXIgPSB0cnVlO1xuICAgICAgICAgIHRoaXMubGluZS5wdXNoKCcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGlzUm93RGVsaW1pdGVyKSB7XG4gICAgICAgIHRoaXMuX19wdXNoKHRoaXMubGluZSk7XG4gICAgICAgIHRoaXMubGluZSA9IFtdO1xuICAgICAgICBpICs9IChyZWYgPSB0aGlzLm9wdGlvbnMucm93RGVsaW1pdGVyKSAhPSBudWxsID8gcmVmLmxlbmd0aCA6IHZvaWQgMDtcbiAgICAgICAgdGhpcy5uZXh0Q2hhciA9IGNoYXJzLmNoYXJBdChpKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghdGhpcy5jb21tZW50aW5nICYmICF0aGlzLnF1b3RpbmcgJiYgKGNoYXIgPT09ICcgJyB8fCBjaGFyID09PSAnXFx0JykpIHtcbiAgICAgIGlmICghKGx0cmltICYmICF0aGlzLmZpZWxkKSkge1xuICAgICAgICB0aGlzLmZpZWxkICs9IGNoYXI7XG4gICAgICB9XG4gICAgICBpZiAoZW5kICYmIGkgKyAxID09PSBsKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudHJpbSB8fCB0aGlzLm9wdGlvbnMucnRyaW0pIHtcbiAgICAgICAgICB0aGlzLmZpZWxkID0gdGhpcy5maWVsZC50cmltUmlnaHQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuY29tbWVudGluZykge1xuICAgICAgdGhpcy5maWVsZCArPSBjaGFyO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBpKys7XG4gICAgfVxuICAgIGlmICghdGhpcy5jb21tZW50aW5nICYmIHRoaXMuZmllbGQubGVuZ3RoID4gdGhpcy5vcHRpb25zLm1heF9saW1pdF9vbl9kYXRhX3JlYWQpIHtcbiAgICAgIHRocm93IEVycm9yKFwiRGVsaW1pdGVyIG5vdCBmb3VuZCBpbiB0aGUgZmlsZSBcIiArIChKU09OLnN0cmluZ2lmeSh0aGlzLm9wdGlvbnMuZGVsaW1pdGVyKSkpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuY29tbWVudGluZyAmJiB0aGlzLmxpbmUubGVuZ3RoID4gdGhpcy5vcHRpb25zLm1heF9saW1pdF9vbl9kYXRhX3JlYWQpIHtcbiAgICAgIHRocm93IEVycm9yKFwiUm93IGRlbGltaXRlciBub3QgZm91bmQgaW4gdGhlIGZpbGUgXCIgKyAoSlNPTi5zdHJpbmdpZnkodGhpcy5vcHRpb25zLnJvd0RlbGltaXRlcikpKTtcbiAgICB9XG4gIH1cbiAgaWYgKGVuZCkge1xuICAgIGlmIChydHJpbSkge1xuICAgICAgaWYgKCF0aGlzLmNsb3NpbmdRdW90ZSkge1xuICAgICAgICB0aGlzLmZpZWxkID0gdGhpcy5maWVsZC50cmltUmlnaHQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmllbGQgIT09ICcnKSB7XG4gICAgICB0aGlzLmxpbmUucHVzaChhdXRvX3BhcnNlKHRoaXMuZmllbGQpKTtcbiAgICAgIHRoaXMuZmllbGQgPSAnJztcbiAgICB9XG4gICAgaWYgKHRoaXMuZmllbGQubGVuZ3RoID4gdGhpcy5vcHRpb25zLm1heF9saW1pdF9vbl9kYXRhX3JlYWQpIHtcbiAgICAgIHRocm93IEVycm9yKFwiRGVsaW1pdGVyIG5vdCBmb3VuZCBpbiB0aGUgZmlsZSBcIiArIChKU09OLnN0cmluZ2lmeSh0aGlzLm9wdGlvbnMuZGVsaW1pdGVyKSkpO1xuICAgIH1cbiAgICBpZiAobCA9PT0gMCkge1xuICAgICAgdGhpcy5saW5lcysrO1xuICAgIH1cbiAgICBpZiAodGhpcy5saW5lLmxlbmd0aCA+IHRoaXMub3B0aW9ucy5tYXhfbGltaXRfb25fZGF0YV9yZWFkKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIlJvdyBkZWxpbWl0ZXIgbm90IGZvdW5kIGluIHRoZSBmaWxlIFwiICsgKEpTT04uc3RyaW5naWZ5KHRoaXMub3B0aW9ucy5yb3dEZWxpbWl0ZXIpKSk7XG4gICAgfVxuICB9XG4gIHRoaXMuYnVmID0gJyc7XG4gIHJlc3VsdHMgPSBbXTtcbiAgd2hpbGUgKGkgPCBsKSB7XG4gICAgdGhpcy5idWYgKz0gY2hhcnMuY2hhckF0KGkpO1xuICAgIHJlc3VsdHMucHVzaChpKyspO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcbiIsIihmdW5jdGlvbigpIHtcblxudmFyIGZuTmFtZU1hdGNoUmVnZXggPSAvXlxccypmdW5jdGlvblxccysoW15cXChcXHNdKilcXHMqLztcblxuZnVuY3Rpb24gX25hbWUoKSB7XG4gIHZhciBtYXRjaCwgbmFtZTtcbiAgaWYgKHRoaXMgPT09IEZ1bmN0aW9uIHx8IHRoaXMgPT09IEZ1bmN0aW9uLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuICAgIG5hbWUgPSBcIkZ1bmN0aW9uXCI7XG4gIH1cbiAgZWxzZSBpZiAodGhpcyAhPT0gRnVuY3Rpb24ucHJvdG90eXBlKSB7XG4gICAgbWF0Y2ggPSAoXCJcIiArIHRoaXMpLm1hdGNoKGZuTmFtZU1hdGNoUmVnZXgpO1xuICAgIG5hbWUgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgfVxuICByZXR1cm4gbmFtZSB8fCBcIlwiO1xufVxuXG4vLyBJbnNwZWN0IHRoZSBwb2x5ZmlsbC1hYmlsaXR5IG9mIHRoaXMgYnJvd3NlclxudmFyIG5lZWRzUG9seWZpbGwgPSAhKFwibmFtZVwiIGluIEZ1bmN0aW9uLnByb3RvdHlwZSAmJiBcIm5hbWVcIiBpbiAoZnVuY3Rpb24geCgpIHt9KSk7XG52YXIgY2FuRGVmaW5lUHJvcCA9IHR5cGVvZiBPYmplY3QuZGVmaW5lUHJvcGVydHkgPT09IFwiZnVuY3Rpb25cIiAmJlxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICB0cnkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgXCJfeHl6XCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gXCJibGFoXCI7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICByZXN1bHQgPSBGdW5jdGlvbi5wcm90b3R5cGUuX3h5eiA9PT0gXCJibGFoXCI7XG4gICAgICBkZWxldGUgRnVuY3Rpb24ucHJvdG90eXBlLl94eXo7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSkoKTtcbnZhciBjYW5EZWZpbmVHZXR0ZXIgPSB0eXBlb2YgT2JqZWN0LnByb3RvdHlwZS5fX2RlZmluZUdldHRlcl9fID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIEZ1bmN0aW9uLnByb3RvdHlwZS5fX2RlZmluZUdldHRlcl9fKFwiX2FiY1wiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIFwiZm9vXCI7XG4gICAgICB9KTtcbiAgICAgIHJlc3VsdCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5fYWJjID09PSBcImZvb1wiO1xuICAgICAgZGVsZXRlIEZ1bmN0aW9uLnByb3RvdHlwZS5fYWJjO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0pKCk7XG5cblxuXG4vLyBBZGQgdGhlIFwicHJpdmF0ZVwiIHByb3BlcnR5IGZvciB0ZXN0aW5nLCBldmVuIGlmIHRoZSByZWFsIHByb3BlcnR5IGNhbiBiZSBwb2x5ZmlsbGVkXG5GdW5jdGlvbi5wcm90b3R5cGUuX25hbWUgPSBfbmFtZTtcblxuXG4vLyBQb2x5ZmlsbCBpdCFcbi8vIEZvcjpcbi8vICAqIElFID49OSA8MTJcbi8vICAqIENocm9tZSA8MzNcbmlmIChuZWVkc1BvbHlmaWxsKSB7XG4gIC8vIEZvcjpcbiAgLy8gICogSUUgPj05IDwxMlxuICAvLyAgKiBDaHJvbWUgPj01IDwzM1xuICBpZiAoY2FuRGVmaW5lUHJvcCkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShGdW5jdGlvbi5wcm90b3R5cGUsIFwibmFtZVwiLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmFtZSA9IF9uYW1lLmNhbGwodGhpcyk7XG5cbiAgICAgICAgLy8gU2luY2UgbmFtZWQgZnVuY3Rpb24gZGVmaW5pdGlvbnMgaGF2ZSBpbW11dGFibGUgbmFtZXMsIGFsc28gbWVtb2l6ZSB0aGVcbiAgICAgICAgLy8gb3V0cHV0IGJ5IGRlZmluaW5nIHRoZSBgbmFtZWAgcHJvcGVydHkgZGlyZWN0bHkgb24gdGhpcyBGdW5jdGlvblxuICAgICAgICAvLyBpbnN0YW5jZSBzbyB0aGF0IHRoaXMgcG9seWZpbGwgd2lsbCBub3QgbmVlZCB0byBiZSBpbnZva2VkIGFnYWluXG4gICAgICAgIGlmICh0aGlzICE9PSBGdW5jdGlvbi5wcm90b3R5cGUpIHtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBuYW1lLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmFtZTtcbiAgICAgIH0sXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuICAvLyBGb3I6XG4gIC8vICAqIENocm9tZSA8NVxuICBlbHNlIGlmIChjYW5EZWZpbmVHZXR0ZXIpIHtcbiAgICAvLyBOT1RFOlxuICAgIC8vIFRoZSBzbmlwcGV0OlxuICAgIC8vXG4gICAgLy8gICAgIHguX19kZWZpbmVHZXR0ZXJfXygneScsIHopO1xuICAgIC8vXG4gICAgLy8gLi4uaXMgZXNzZW50aWFsbHkgZXF1aXZhbGVudCB0bzpcbiAgICAvL1xuICAgIC8vICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoeCwgJ3knLCB7XG4gICAgLy8gICAgICAgZ2V0OiB6LFxuICAgIC8vICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgIC8vIDwtLSBrZXkgZGlmZmVyZW5jZSAjMVxuICAgIC8vICAgICAgIGVudW1lcmFibGU6IHRydWUgICAgIC8vIDwtLSBrZXkgZGlmZmVyZW5jZSAjMlxuICAgIC8vICAgICB9KTtcbiAgICAvL1xuICAgIEZ1bmN0aW9uLnByb3RvdHlwZS5fX2RlZmluZUdldHRlcl9fKFwibmFtZVwiLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBuYW1lID0gX25hbWUuY2FsbCh0aGlzKTtcblxuICAgICAgLy8gU2luY2UgbmFtZWQgZnVuY3Rpb24gZGVmaW5pdGlvbnMgaGF2ZSBpbW11dGFibGUgbmFtZXMsIGFsc28gbWVtb2l6ZSB0aGVcbiAgICAgIC8vIG91dHB1dCBieSBkZWZpbmluZyB0aGUgYG5hbWVgIHByb3BlcnR5IGRpcmVjdGx5IG9uIHRoaXMgRnVuY3Rpb25cbiAgICAgIC8vIGluc3RhbmNlIHNvIHRoYXQgdGhpcyBwb2x5ZmlsbCB3aWxsIG5vdCBuZWVkIHRvIGJlIGludm9rZWQgYWdhaW5cbiAgICAgIGlmICh0aGlzICE9PSBGdW5jdGlvbi5wcm90b3R5cGUpIHtcbiAgICAgICAgdGhpcy5fX2RlZmluZUdldHRlcl9fKFwibmFtZVwiLCBmdW5jdGlvbigpIHsgcmV0dXJuIG5hbWU7IH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmFtZTtcbiAgICB9KTtcbiAgfVxufVxuXG59KSgpO1xuIl19
