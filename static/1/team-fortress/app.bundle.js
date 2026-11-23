(() => {
  var Gr = Object.create;
  var Ze = Object.defineProperty;
  var Pr = Object.getOwnPropertyDescriptor;
  var Tr = Object.getOwnPropertyNames;
  var Dr = Object.getPrototypeOf;
  var Br = Object.prototype.hasOwnProperty;
  var Se = (e => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(e, {
    get: (r, t) => (typeof require !== "undefined" ? require : r)[t]
  }) : e)(function (e) {
    if (typeof require !== "undefined") {
      return require.apply(this, arguments);
    }
    throw Error("Dynamic require of \"" + e + "\" is not supported");
  });
  var pe = (e, r, t) => () => {
    if (t) {
      throw t[0];
    }
    try {
      if (e) {
        r = e(e = 0);
      }
      return r;
    } catch (n) {
      t = [n];
      throw n;
    }
  };
  var $e = (e, r) => () => {
    try {
      if (!r) {
        e((r = {
          exports: {}
        }).exports, r);
      }
      return r.exports;
    } catch (t) {
      r = 0;
      throw t;
    }
  };
  var Ir = (e, r, t, n) => {
    if (r && typeof r == "object" || typeof r == "function") {
      for (let a of Tr(r)) {
        if (!Br.call(e, a) && a !== t) {
          Ze(e, a, {
            get: () => r[a],
            enumerable: !(n = Pr(r, a)) || n.enumerable
          });
        }
      }
    }
    return e;
  };
  var Ur = (e, r, t) => {
    t = e != null ? Gr(Dr(e)) : {};
    return Ir(r || !e || !e.__esModule ? Ze(t, "default", {
      value: e,
      enumerable: true
    }) : t, e);
  };
  var rr = $e((er, Ie) => {
    (function (e) {
      if (typeof er == "object" && typeof Ie !== "undefined") {
        Ie.exports = e();
      } else if (typeof define == "function" && define.amd) {
        define([], e);
      } else {
        (typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : this).JSZip = e();
      }
    })(function () {
      return function e(r, t, n) {
        function a(c, _) {
          if (!t[c]) {
            if (!r[c]) {
              var u = typeof Se == "function" && Se;
              if (!_ && u) {
                return u(c, true);
              }
              if (o) {
                return o(c, true);
              }
              var m = new Error("Cannot find module '" + c + "'");
              m.code = "MODULE_NOT_FOUND";
              throw m;
            }
            var f = t[c] = {
              exports: {}
            };
            r[c][0].call(f.exports, function (v) {
              var g = r[c][1][v];
              return a(g || v);
            }, f, f.exports, e, r, t, n);
          }
          return t[c].exports;
        }
        var o = typeof Se == "function" && Se;
        for (var l = 0; l < n.length; l++) {
          a(n[l]);
        }
        return a;
      }({
        1: [function (e, r, t) {
          "use strict";

          var n = e("./utils");
          var a = e("./support");
          var o = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
          t.encode = function (l) {
            var c;
            var _;
            var u;
            var m;
            var f;
            var v;
            var g;
            var h = [];
            for (var p = 0, b = l.length, S = b, w = n.getTypeOf(l) !== "string"; p < l.length;) {
              S = b - p;
              u = w ? (c = l[p++], _ = p < b ? l[p++] : 0, p < b ? l[p++] : 0) : (c = l.charCodeAt(p++), _ = p < b ? l.charCodeAt(p++) : 0, p < b ? l.charCodeAt(p++) : 0);
              m = c >> 2;
              f = (c & 3) << 4 | _ >> 4;
              v = S > 1 ? (_ & 15) << 2 | u >> 6 : 64;
              g = S > 2 ? u & 63 : 64;
              h.push(o.charAt(m) + o.charAt(f) + o.charAt(v) + o.charAt(g));
            }
            return h.join("");
          };
          t.decode = function (l) {
            var c;
            var _;
            var u;
            var m;
            var f;
            var v;
            var g = 0;
            var h = 0;
            var p = "data:";
            if (l.substr(0, p.length) === p) {
              throw new Error("Invalid base64 input, it looks like a data url.");
            }
            var b;
            var S = (l = l.replace(/[^A-Za-z0-9+/=]/g, "")).length * 3 / 4;
            if (l.charAt(l.length - 1) === o.charAt(64)) {
              S--;
            }
            if (l.charAt(l.length - 2) === o.charAt(64)) {
              S--;
            }
            if (S % 1 != 0) {
              throw new Error("Invalid base64 input, bad content length.");
            }
            for (b = a.uint8array ? new Uint8Array(S | 0) : new Array(S | 0); g < l.length;) {
              c = o.indexOf(l.charAt(g++)) << 2 | (m = o.indexOf(l.charAt(g++))) >> 4;
              _ = (m & 15) << 4 | (f = o.indexOf(l.charAt(g++))) >> 2;
              u = (f & 3) << 6 | (v = o.indexOf(l.charAt(g++)));
              b[h++] = c;
              if (f !== 64) {
                b[h++] = _;
              }
              if (v !== 64) {
                b[h++] = u;
              }
            }
            return b;
          };
        }, {
          "./support": 30,
          "./utils": 32
        }],
        2: [function (e, r, t) {
          "use strict";

          var n = e("./external");
          var a = e("./stream/DataWorker");
          var o = e("./stream/Crc32Probe");
          var l = e("./stream/DataLengthProbe");
          function c(_, u, m, f, v) {
            this.compressedSize = _;
            this.uncompressedSize = u;
            this.crc32 = m;
            this.compression = f;
            this.compressedContent = v;
          }
          c.prototype = {
            getContentWorker: function () {
              var _ = new a(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new l("data_length"));
              var u = this;
              _.on("end", function () {
                if (this.streamInfo.data_length !== u.uncompressedSize) {
                  throw new Error("Bug : uncompressed data size mismatch");
                }
              });
              return _;
            },
            getCompressedWorker: function () {
              return new a(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
            }
          };
          c.createWorkerFrom = function (_, u, m) {
            return _.pipe(new o()).pipe(new l("uncompressedSize")).pipe(u.compressWorker(m)).pipe(new l("compressedSize")).withStreamInfo("compression", u);
          };
          r.exports = c;
        }, {
          "./external": 6,
          "./stream/Crc32Probe": 25,
          "./stream/DataLengthProbe": 26,
          "./stream/DataWorker": 27
        }],
        3: [function (e, r, t) {
          "use strict";

          var n = e("./stream/GenericWorker");
          t.STORE = {
            magic: "\0\0",
            compressWorker: function () {
              return new n("STORE compression");
            },
            uncompressWorker: function () {
              return new n("STORE decompression");
            }
          };
          t.DEFLATE = e("./flate");
        }, {
          "./flate": 7,
          "./stream/GenericWorker": 28
        }],
        4: [function (e, r, t) {
          "use strict";

          var n = e("./utils");
          var a = function () {
            var o;
            var l = [];
            for (var c = 0; c < 256; c++) {
              o = c;
              for (var _ = 0; _ < 8; _++) {
                o = o & 1 ? o >>> 1 ^ -306674912 : o >>> 1;
              }
              l[c] = o;
            }
            return l;
          }();
          r.exports = function (o, l) {
            if (o !== undefined && o.length) {
              if (n.getTypeOf(o) !== "string") {
                return function (c, _, u, m) {
                  var f = a;
                  var v = m + u;
                  c ^= -1;
                  for (var g = m; g < v; g++) {
                    c = c >>> 8 ^ f[(c ^ _[g]) & 255];
                  }
                  return c ^ -1;
                }(l | 0, o, o.length, 0);
              } else {
                return function (c, _, u, m) {
                  var f = a;
                  var v = m + u;
                  c ^= -1;
                  for (var g = m; g < v; g++) {
                    c = c >>> 8 ^ f[(c ^ _.charCodeAt(g)) & 255];
                  }
                  return c ^ -1;
                }(l | 0, o, o.length, 0);
              }
            } else {
              return 0;
            }
          };
        }, {
          "./utils": 32
        }],
        5: [function (e, r, t) {
          "use strict";

          t.base64 = false;
          t.binary = false;
          t.dir = false;
          t.createFolders = true;
          t.date = null;
          t.compression = null;
          t.compressionOptions = null;
          t.comment = null;
          t.unixPermissions = null;
          t.dosPermissions = null;
        }, {}],
        6: [function (e, r, t) {
          "use strict";

          var n = null;
          n = typeof Promise !== "undefined" ? Promise : e("lie");
          r.exports = {
            Promise: n
          };
        }, {
          lie: 37
        }],
        7: [function (e, r, t) {
          "use strict";

          var n = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Uint32Array !== "undefined";
          var a = e("pako");
          var o = e("./utils");
          var l = e("./stream/GenericWorker");
          var c = n ? "uint8array" : "array";
          function _(u, m) {
            l.call(this, "FlateWorker/" + u);
            this._pako = null;
            this._pakoAction = u;
            this._pakoOptions = m;
            this.meta = {};
          }
          t.magic = "\b\0";
          o.inherits(_, l);
          _.prototype.processChunk = function (u) {
            this.meta = u.meta;
            if (this._pako === null) {
              this._createPako();
            }
            this._pako.push(o.transformTo(c, u.data), false);
          };
          _.prototype.flush = function () {
            l.prototype.flush.call(this);
            if (this._pako === null) {
              this._createPako();
            }
            this._pako.push([], true);
          };
          _.prototype.cleanUp = function () {
            l.prototype.cleanUp.call(this);
            this._pako = null;
          };
          _.prototype._createPako = function () {
            this._pako = new a[this._pakoAction]({
              raw: true,
              level: this._pakoOptions.level || -1
            });
            var u = this;
            this._pako.onData = function (m) {
              u.push({
                data: m,
                meta: u.meta
              });
            };
          };
          t.compressWorker = function (u) {
            return new _("Deflate", u);
          };
          t.uncompressWorker = function () {
            return new _("Inflate", {});
          };
        }, {
          "./stream/GenericWorker": 28,
          "./utils": 32,
          pako: 38
        }],
        8: [function (e, r, t) {
          "use strict";

          function n(f, v) {
            var g;
            var h = "";
            for (g = 0; g < v; g++) {
              h += String.fromCharCode(f & 255);
              f >>>= 8;
            }
            return h;
          }
          function a(f, v, g, h, p, b) {
            var S;
            var w;
            var A = f.file;
            var k = f.compression;
            var G = b !== c.utf8encode;
            var D = o.transformTo("string", b(A.name));
            var F = o.transformTo("string", c.utf8encode(A.name));
            var H = A.comment;
            var z = o.transformTo("string", b(H));
            var x = o.transformTo("string", c.utf8encode(H));
            var I = F.length !== A.name.length;
            var E = x.length !== H.length;
            var M = "";
            var Z = "";
            var N = "";
            var $ = A.dir;
            var O = A.date;
            var J = {
              crc32: 0,
              compressedSize: 0,
              uncompressedSize: 0
            };
            if (!v || !!g) {
              J.crc32 = f.crc32;
              J.compressedSize = f.compressedSize;
              J.uncompressedSize = f.uncompressedSize;
            }
            var B = 0;
            if (v) {
              B |= 8;
            }
            if (!G && (!!I || !!E)) {
              B |= 2048;
            }
            var T = 0;
            var K = 0;
            if ($) {
              T |= 16;
            }
            if (p === "UNIX") {
              K = 798;
              T |= function (X, ae) {
                var ce = X;
                if (!X) {
                  ce = ae ? 16893 : 33204;
                }
                return (ce & 65535) << 16;
              }(A.unixPermissions, $);
            } else {
              K = 20;
              T |= function (X) {
                return (X || 0) & 63;
              }(A.dosPermissions);
            }
            S = O.getUTCHours();
            S <<= 6;
            S |= O.getUTCMinutes();
            S <<= 5;
            S |= O.getUTCSeconds() / 2;
            w = O.getUTCFullYear() - 1980;
            w <<= 4;
            w |= O.getUTCMonth() + 1;
            w <<= 5;
            w |= O.getUTCDate();
            if (I) {
              Z = n(1, 1) + n(_(D), 4) + F;
              M += "up" + n(Z.length, 2) + Z;
            }
            if (E) {
              N = n(1, 1) + n(_(z), 4) + x;
              M += "uc" + n(N.length, 2) + N;
            }
            var q = "";
            q += `
\0`;
            q += n(B, 2);
            q += k.magic;
            q += n(S, 2);
            q += n(w, 2);
            q += n(J.crc32, 4);
            q += n(J.compressedSize, 4);
            q += n(J.uncompressedSize, 4);
            q += n(D.length, 2);
            q += n(M.length, 2);
            return {
              fileRecord: u.LOCAL_FILE_HEADER + q + D + M,
              dirRecord: u.CENTRAL_FILE_HEADER + n(K, 2) + q + n(z.length, 2) + "\0\0\0\0" + n(T, 4) + n(h, 4) + D + M + z
            };
          }
          var o = e("../utils");
          var l = e("../stream/GenericWorker");
          var c = e("../utf8");
          var _ = e("../crc32");
          var u = e("../signature");
          function m(f, v, g, h) {
            l.call(this, "ZipFileWorker");
            this.bytesWritten = 0;
            this.zipComment = v;
            this.zipPlatform = g;
            this.encodeFileName = h;
            this.streamFiles = f;
            this.accumulate = false;
            this.contentBuffer = [];
            this.dirRecords = [];
            this.currentSourceOffset = 0;
            this.entriesCount = 0;
            this.currentFile = null;
            this._sources = [];
          }
          o.inherits(m, l);
          m.prototype.push = function (f) {
            var v = f.meta.percent || 0;
            var g = this.entriesCount;
            var h = this._sources.length;
            if (this.accumulate) {
              this.contentBuffer.push(f);
            } else {
              this.bytesWritten += f.data.length;
              l.prototype.push.call(this, {
                data: f.data,
                meta: {
                  currentFile: this.currentFile,
                  percent: g ? (v + (g - h - 1) * 100) / g : 100
                }
              });
            }
          };
          m.prototype.openedSource = function (f) {
            this.currentSourceOffset = this.bytesWritten;
            this.currentFile = f.file.name;
            var v = this.streamFiles && !f.file.dir;
            if (v) {
              var g = a(f, v, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
              this.push({
                data: g.fileRecord,
                meta: {
                  percent: 0
                }
              });
            } else {
              this.accumulate = true;
            }
          };
          m.prototype.closedSource = function (f) {
            this.accumulate = false;
            var v = this.streamFiles && !f.file.dir;
            var g = a(f, v, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.dirRecords.push(g.dirRecord);
            if (v) {
              this.push({
                data: function (h) {
                  return u.DATA_DESCRIPTOR + n(h.crc32, 4) + n(h.compressedSize, 4) + n(h.uncompressedSize, 4);
                }(f),
                meta: {
                  percent: 100
                }
              });
            } else {
              for (this.push({
                data: g.fileRecord,
                meta: {
                  percent: 0
                }
              }); this.contentBuffer.length;) {
                this.push(this.contentBuffer.shift());
              }
            }
            this.currentFile = null;
          };
          m.prototype.flush = function () {
            var f = this.bytesWritten;
            for (var v = 0; v < this.dirRecords.length; v++) {
              this.push({
                data: this.dirRecords[v],
                meta: {
                  percent: 100
                }
              });
            }
            var g = this.bytesWritten - f;
            var h = function (p, b, S, w, A) {
              var k = o.transformTo("string", A(w));
              return u.CENTRAL_DIRECTORY_END + "\0\0\0\0" + n(p, 2) + n(p, 2) + n(b, 4) + n(S, 4) + n(k.length, 2) + k;
            }(this.dirRecords.length, g, f, this.zipComment, this.encodeFileName);
            this.push({
              data: h,
              meta: {
                percent: 100
              }
            });
          };
          m.prototype.prepareNextSource = function () {
            this.previous = this._sources.shift();
            this.openedSource(this.previous.streamInfo);
            if (this.isPaused) {
              this.previous.pause();
            } else {
              this.previous.resume();
            }
          };
          m.prototype.registerPrevious = function (f) {
            this._sources.push(f);
            var v = this;
            f.on("data", function (g) {
              v.processChunk(g);
            });
            f.on("end", function () {
              v.closedSource(v.previous.streamInfo);
              if (v._sources.length) {
                v.prepareNextSource();
              } else {
                v.end();
              }
            });
            f.on("error", function (g) {
              v.error(g);
            });
            return this;
          };
          m.prototype.resume = function () {
            return !!l.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? undefined : (this.end(), true));
          };
          m.prototype.error = function (f) {
            var v = this._sources;
            if (!l.prototype.error.call(this, f)) {
              return false;
            }
            for (var g = 0; g < v.length; g++) {
              try {
                v[g].error(f);
              } catch {}
            }
            return true;
          };
          m.prototype.lock = function () {
            l.prototype.lock.call(this);
            for (var f = this._sources, v = 0; v < f.length; v++) {
              f[v].lock();
            }
          };
          r.exports = m;
        }, {
          "../crc32": 4,
          "../signature": 23,
          "../stream/GenericWorker": 28,
          "../utf8": 31,
          "../utils": 32
        }],
        9: [function (e, r, t) {
          "use strict";

          var n = e("../compressions");
          var a = e("./ZipFileWorker");
          t.generateWorker = function (o, l, c) {
            var _ = new a(l.streamFiles, c, l.platform, l.encodeFileName);
            var u = 0;
            try {
              o.forEach(function (m, f) {
                u++;
                var v = function (b, S) {
                  var w = b || S;
                  var A = n[w];
                  if (!A) {
                    throw new Error(w + " is not a valid compression method !");
                  }
                  return A;
                }(f.options.compression, l.compression);
                var g = f.options.compressionOptions || l.compressionOptions || {};
                var h = f.dir;
                var p = f.date;
                f._compressWorker(v, g).withStreamInfo("file", {
                  name: m,
                  dir: h,
                  date: p,
                  comment: f.comment || "",
                  unixPermissions: f.unixPermissions,
                  dosPermissions: f.dosPermissions
                }).pipe(_);
              });
              _.entriesCount = u;
            } catch (m) {
              _.error(m);
            }
            return _;
          };
        }, {
          "../compressions": 3,
          "./ZipFileWorker": 8
        }],
        10: [function (e, r, t) {
          "use strict";

          function n() {
            if (!(this instanceof n)) {
              return new n();
            }
            if (arguments.length) {
              throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
            }
            this.files = Object.create(null);
            this.comment = null;
            this.root = "";
            this.clone = function () {
              var a = new n();
              for (var o in this) {
                if (typeof this[o] != "function") {
                  a[o] = this[o];
                }
              }
              return a;
            };
          }
          (n.prototype = e("./object")).loadAsync = e("./load");
          n.support = e("./support");
          n.defaults = e("./defaults");
          n.version = "3.10.1";
          n.loadAsync = function (a, o) {
            return new n().loadAsync(a, o);
          };
          n.external = e("./external");
          r.exports = n;
        }, {
          "./defaults": 5,
          "./external": 6,
          "./load": 11,
          "./object": 15,
          "./support": 30
        }],
        11: [function (e, r, t) {
          "use strict";

          var n = e("./utils");
          var a = e("./external");
          var o = e("./utf8");
          var l = e("./zipEntries");
          var c = e("./stream/Crc32Probe");
          var _ = e("./nodejsUtils");
          function u(m) {
            return new a.Promise(function (f, v) {
              var g = m.decompressed.getContentWorker().pipe(new c());
              g.on("error", function (h) {
                v(h);
              }).on("end", function () {
                if (g.streamInfo.crc32 !== m.decompressed.crc32) {
                  v(new Error("Corrupted zip : CRC32 mismatch"));
                } else {
                  f();
                }
              }).resume();
            });
          }
          r.exports = function (m, f) {
            var v = this;
            f = n.extend(f || {}, {
              base64: false,
              checkCRC32: false,
              optimizedBinaryString: false,
              createFolders: false,
              decodeFileName: o.utf8decode
            });
            if (_.isNode && _.isStream(m)) {
              return a.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file."));
            } else {
              return n.prepareContent("the loaded zip file", m, true, f.optimizedBinaryString, f.base64).then(function (g) {
                var h = new l(f);
                h.load(g);
                return h;
              }).then(function (g) {
                var h = [a.Promise.resolve(g)];
                var p = g.files;
                if (f.checkCRC32) {
                  for (var b = 0; b < p.length; b++) {
                    h.push(u(p[b]));
                  }
                }
                return a.Promise.all(h);
              }).then(function (g) {
                var h = g.shift();
                for (var p = h.files, b = 0; b < p.length; b++) {
                  var S = p[b];
                  var w = S.fileNameStr;
                  var A = n.resolve(S.fileNameStr);
                  v.file(A, S.decompressed, {
                    binary: true,
                    optimizedBinaryString: true,
                    date: S.date,
                    dir: S.dir,
                    comment: S.fileCommentStr.length ? S.fileCommentStr : null,
                    unixPermissions: S.unixPermissions,
                    dosPermissions: S.dosPermissions,
                    createFolders: f.createFolders
                  });
                  if (!S.dir) {
                    v.file(A).unsafeOriginalName = w;
                  }
                }
                if (h.zipComment.length) {
                  v.comment = h.zipComment;
                }
                return v;
              });
            }
          };
        }, {
          "./external": 6,
          "./nodejsUtils": 14,
          "./stream/Crc32Probe": 25,
          "./utf8": 31,
          "./utils": 32,
          "./zipEntries": 33
        }],
        12: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          var a = e("../stream/GenericWorker");
          function o(l, c) {
            a.call(this, "Nodejs stream input adapter for " + l);
            this._upstreamEnded = false;
            this._bindStream(c);
          }
          n.inherits(o, a);
          o.prototype._bindStream = function (l) {
            var c = this;
            (this._stream = l).pause();
            l.on("data", function (_) {
              c.push({
                data: _,
                meta: {
                  percent: 0
                }
              });
            }).on("error", function (_) {
              if (c.isPaused) {
                this.generatedError = _;
              } else {
                c.error(_);
              }
            }).on("end", function () {
              if (c.isPaused) {
                c._upstreamEnded = true;
              } else {
                c.end();
              }
            });
          };
          o.prototype.pause = function () {
            return !!a.prototype.pause.call(this) && (this._stream.pause(), true);
          };
          o.prototype.resume = function () {
            return !!a.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
          };
          r.exports = o;
        }, {
          "../stream/GenericWorker": 28,
          "../utils": 32
        }],
        13: [function (e, r, t) {
          "use strict";

          var n = e("readable-stream").Readable;
          function a(o, l, c) {
            n.call(this, l);
            this._helper = o;
            var _ = this;
            o.on("data", function (u, m) {
              if (!_.push(u)) {
                _._helper.pause();
              }
              if (c) {
                c(m);
              }
            }).on("error", function (u) {
              _.emit("error", u);
            }).on("end", function () {
              _.push(null);
            });
          }
          e("../utils").inherits(a, n);
          a.prototype._read = function () {
            this._helper.resume();
          };
          r.exports = a;
        }, {
          "../utils": 32,
          "readable-stream": 16
        }],
        14: [function (e, r, t) {
          "use strict";

          r.exports = {
            isNode: typeof Buffer !== "undefined",
            newBufferFrom: function (n, a) {
              if (Buffer.from && Buffer.from !== Uint8Array.from) {
                return Buffer.from(n, a);
              }
              if (typeof n == "number") {
                throw new Error("The \"data\" argument must not be a number");
              }
              return new Buffer(n, a);
            },
            allocBuffer: function (n) {
              if (Buffer.alloc) {
                return Buffer.alloc(n);
              }
              var a = new Buffer(n);
              a.fill(0);
              return a;
            },
            isBuffer: function (n) {
              return Buffer.isBuffer(n);
            },
            isStream: function (n) {
              return n && typeof n.on == "function" && typeof n.pause == "function" && typeof n.resume == "function";
            }
          };
        }, {}],
        15: [function (e, r, t) {
          "use strict";

          function n(A, k, G) {
            var D;
            var F = o.getTypeOf(k);
            var H = o.extend(G || {}, _);
            H.date = H.date || new Date();
            if (H.compression !== null) {
              H.compression = H.compression.toUpperCase();
            }
            if (typeof H.unixPermissions == "string") {
              H.unixPermissions = parseInt(H.unixPermissions, 8);
            }
            if (H.unixPermissions && H.unixPermissions & 16384) {
              H.dir = true;
            }
            if (H.dosPermissions && H.dosPermissions & 16) {
              H.dir = true;
            }
            if (H.dir) {
              A = p(A);
            }
            if (H.createFolders && (D = h(A))) {
              b.call(this, D, true);
            }
            var z = F === "string" && H.binary === false && H.base64 === false;
            if (!G || G.binary === undefined) {
              H.binary = !z;
            }
            if (k instanceof u && k.uncompressedSize === 0 || H.dir || !k || k.length === 0) {
              H.base64 = false;
              H.binary = true;
              k = "";
              H.compression = "STORE";
              F = "string";
            }
            var x = null;
            x = k instanceof u || k instanceof l ? k : v.isNode && v.isStream(k) ? new g(A, k) : o.prepareContent(A, k, H.binary, H.optimizedBinaryString, H.base64);
            var I = new m(A, x, H);
            this.files[A] = I;
          }
          var a = e("./utf8");
          var o = e("./utils");
          var l = e("./stream/GenericWorker");
          var c = e("./stream/StreamHelper");
          var _ = e("./defaults");
          var u = e("./compressedObject");
          var m = e("./zipObject");
          var f = e("./generate");
          var v = e("./nodejsUtils");
          var g = e("./nodejs/NodejsStreamInputAdapter");
          var h = function (A) {
            if (A.slice(-1) === "/") {
              A = A.substring(0, A.length - 1);
            }
            var k = A.lastIndexOf("/");
            if (k > 0) {
              return A.substring(0, k);
            } else {
              return "";
            }
          };
          var p = function (A) {
            if (A.slice(-1) !== "/") {
              A += "/";
            }
            return A;
          };
          var b = function (A, k) {
            k = k !== undefined ? k : _.createFolders;
            A = p(A);
            if (!this.files[A]) {
              n.call(this, A, null, {
                dir: true,
                createFolders: k
              });
            }
            return this.files[A];
          };
          function S(A) {
            return Object.prototype.toString.call(A) === "[object RegExp]";
          }
          var w = {
            load: function () {
              throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
            },
            forEach: function (A) {
              var k;
              var G;
              var D;
              for (k in this.files) {
                D = this.files[k];
                if ((G = k.slice(this.root.length, k.length)) && k.slice(0, this.root.length) === this.root) {
                  A(G, D);
                }
              }
            },
            filter: function (A) {
              var k = [];
              this.forEach(function (G, D) {
                if (A(G, D)) {
                  k.push(D);
                }
              });
              return k;
            },
            file: function (A, k, G) {
              if (arguments.length !== 1) {
                A = this.root + A;
                n.call(this, A, k, G);
                return this;
              }
              if (S(A)) {
                var D = A;
                return this.filter(function (H, z) {
                  return !z.dir && D.test(H);
                });
              }
              var F = this.files[this.root + A];
              if (F && !F.dir) {
                return F;
              } else {
                return null;
              }
            },
            folder: function (A) {
              if (!A) {
                return this;
              }
              if (S(A)) {
                return this.filter(function (F, H) {
                  return H.dir && A.test(F);
                });
              }
              var k = this.root + A;
              var G = b.call(this, k);
              var D = this.clone();
              D.root = G.name;
              return D;
            },
            remove: function (A) {
              A = this.root + A;
              var k = this.files[A];
              if (!k) {
                if (A.slice(-1) !== "/") {
                  A += "/";
                }
                k = this.files[A];
              }
              if (k && !k.dir) {
                delete this.files[A];
              } else {
                for (var G = this.filter(function (F, H) {
                    return H.name.slice(0, A.length) === A;
                  }), D = 0; D < G.length; D++) {
                  delete this.files[G[D].name];
                }
              }
              return this;
            },
            generate: function () {
              throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
            },
            generateInternalStream: function (A) {
              var k;
              var G = {};
              try {
                (G = o.extend(A || {}, {
                  streamFiles: false,
                  compression: "STORE",
                  compressionOptions: null,
                  type: "",
                  platform: "DOS",
                  comment: null,
                  mimeType: "application/zip",
                  encodeFileName: a.utf8encode
                })).type = G.type.toLowerCase();
                G.compression = G.compression.toUpperCase();
                if (G.type === "binarystring") {
                  G.type = "string";
                }
                if (!G.type) {
                  throw new Error("No output type specified.");
                }
                o.checkSupport(G.type);
                if (G.platform === "darwin" || G.platform === "freebsd" || G.platform === "linux" || G.platform === "sunos") {
                  G.platform = "UNIX";
                }
                if (G.platform === "win32") {
                  G.platform = "DOS";
                }
                var D = G.comment || this.comment || "";
                k = f.generateWorker(this, G, D);
              } catch (F) {
                (k = new l("error")).error(F);
              }
              return new c(k, G.type || "string", G.mimeType);
            },
            generateAsync: function (A, k) {
              return this.generateInternalStream(A).accumulate(k);
            },
            generateNodeStream: function (A, k) {
              if (!(A = A || {}).type) {
                A.type = "nodebuffer";
              }
              return this.generateInternalStream(A).toNodejsStream(k);
            }
          };
          r.exports = w;
        }, {
          "./compressedObject": 2,
          "./defaults": 5,
          "./generate": 9,
          "./nodejs/NodejsStreamInputAdapter": 12,
          "./nodejsUtils": 14,
          "./stream/GenericWorker": 28,
          "./stream/StreamHelper": 29,
          "./utf8": 31,
          "./utils": 32,
          "./zipObject": 35
        }],
        16: [function (e, r, t) {
          "use strict";

          r.exports = e("stream");
        }, {
          stream: undefined
        }],
        17: [function (e, r, t) {
          "use strict";

          var n = e("./DataReader");
          function a(o) {
            n.call(this, o);
            for (var l = 0; l < this.data.length; l++) {
              o[l] = o[l] & 255;
            }
          }
          e("../utils").inherits(a, n);
          a.prototype.byteAt = function (o) {
            return this.data[this.zero + o];
          };
          a.prototype.lastIndexOfSignature = function (o) {
            var l = o.charCodeAt(0);
            var c = o.charCodeAt(1);
            var _ = o.charCodeAt(2);
            var u = o.charCodeAt(3);
            for (var m = this.length - 4; m >= 0; --m) {
              if (this.data[m] === l && this.data[m + 1] === c && this.data[m + 2] === _ && this.data[m + 3] === u) {
                return m - this.zero;
              }
            }
            return -1;
          };
          a.prototype.readAndCheckSignature = function (o) {
            var l = o.charCodeAt(0);
            var c = o.charCodeAt(1);
            var _ = o.charCodeAt(2);
            var u = o.charCodeAt(3);
            var m = this.readData(4);
            return l === m[0] && c === m[1] && _ === m[2] && u === m[3];
          };
          a.prototype.readData = function (o) {
            this.checkOffset(o);
            if (o === 0) {
              return [];
            }
            var l = this.data.slice(this.zero + this.index, this.zero + this.index + o);
            this.index += o;
            return l;
          };
          r.exports = a;
        }, {
          "../utils": 32,
          "./DataReader": 18
        }],
        18: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          function a(o) {
            this.data = o;
            this.length = o.length;
            this.index = 0;
            this.zero = 0;
          }
          a.prototype = {
            checkOffset: function (o) {
              this.checkIndex(this.index + o);
            },
            checkIndex: function (o) {
              if (this.length < this.zero + o || o < 0) {
                throw new Error("End of data reached (data length = " + this.length + ", asked index = " + o + "). Corrupted zip ?");
              }
            },
            setIndex: function (o) {
              this.checkIndex(o);
              this.index = o;
            },
            skip: function (o) {
              this.setIndex(this.index + o);
            },
            byteAt: function () {},
            readInt: function (o) {
              var l;
              var c = 0;
              this.checkOffset(o);
              l = this.index + o - 1;
              for (; l >= this.index; l--) {
                c = (c << 8) + this.byteAt(l);
              }
              this.index += o;
              return c;
            },
            readString: function (o) {
              return n.transformTo("string", this.readData(o));
            },
            readData: function () {},
            lastIndexOfSignature: function () {},
            readAndCheckSignature: function () {},
            readDate: function () {
              var o = this.readInt(4);
              return new Date(Date.UTC(1980 + (o >> 25 & 127), (o >> 21 & 15) - 1, o >> 16 & 31, o >> 11 & 31, o >> 5 & 63, (o & 31) << 1));
            }
          };
          r.exports = a;
        }, {
          "../utils": 32
        }],
        19: [function (e, r, t) {
          "use strict";

          var n = e("./Uint8ArrayReader");
          function a(o) {
            n.call(this, o);
          }
          e("../utils").inherits(a, n);
          a.prototype.readData = function (o) {
            this.checkOffset(o);
            var l = this.data.slice(this.zero + this.index, this.zero + this.index + o);
            this.index += o;
            return l;
          };
          r.exports = a;
        }, {
          "../utils": 32,
          "./Uint8ArrayReader": 21
        }],
        20: [function (e, r, t) {
          "use strict";

          var n = e("./DataReader");
          function a(o) {
            n.call(this, o);
          }
          e("../utils").inherits(a, n);
          a.prototype.byteAt = function (o) {
            return this.data.charCodeAt(this.zero + o);
          };
          a.prototype.lastIndexOfSignature = function (o) {
            return this.data.lastIndexOf(o) - this.zero;
          };
          a.prototype.readAndCheckSignature = function (o) {
            return o === this.readData(4);
          };
          a.prototype.readData = function (o) {
            this.checkOffset(o);
            var l = this.data.slice(this.zero + this.index, this.zero + this.index + o);
            this.index += o;
            return l;
          };
          r.exports = a;
        }, {
          "../utils": 32,
          "./DataReader": 18
        }],
        21: [function (e, r, t) {
          "use strict";

          var n = e("./ArrayReader");
          function a(o) {
            n.call(this, o);
          }
          e("../utils").inherits(a, n);
          a.prototype.readData = function (o) {
            this.checkOffset(o);
            if (o === 0) {
              return new Uint8Array(0);
            }
            var l = this.data.subarray(this.zero + this.index, this.zero + this.index + o);
            this.index += o;
            return l;
          };
          r.exports = a;
        }, {
          "../utils": 32,
          "./ArrayReader": 17
        }],
        22: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          var a = e("../support");
          var o = e("./ArrayReader");
          var l = e("./StringReader");
          var c = e("./NodeBufferReader");
          var _ = e("./Uint8ArrayReader");
          r.exports = function (u) {
            var m = n.getTypeOf(u);
            n.checkSupport(m);
            if (m !== "string" || a.uint8array) {
              if (m === "nodebuffer") {
                return new c(u);
              } else if (a.uint8array) {
                return new _(n.transformTo("uint8array", u));
              } else {
                return new o(n.transformTo("array", u));
              }
            } else {
              return new l(u);
            }
          };
        }, {
          "../support": 30,
          "../utils": 32,
          "./ArrayReader": 17,
          "./NodeBufferReader": 19,
          "./StringReader": 20,
          "./Uint8ArrayReader": 21
        }],
        23: [function (e, r, t) {
          "use strict";

          t.LOCAL_FILE_HEADER = "PK";
          t.CENTRAL_FILE_HEADER = "PK";
          t.CENTRAL_DIRECTORY_END = "PK";
          t.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK";
          t.ZIP64_CENTRAL_DIRECTORY_END = "PK";
          t.DATA_DESCRIPTOR = "PK\b";
        }, {}],
        24: [function (e, r, t) {
          "use strict";

          var n = e("./GenericWorker");
          var a = e("../utils");
          function o(l) {
            n.call(this, "ConvertWorker to " + l);
            this.destType = l;
          }
          a.inherits(o, n);
          o.prototype.processChunk = function (l) {
            this.push({
              data: a.transformTo(this.destType, l.data),
              meta: l.meta
            });
          };
          r.exports = o;
        }, {
          "../utils": 32,
          "./GenericWorker": 28
        }],
        25: [function (e, r, t) {
          "use strict";

          var n = e("./GenericWorker");
          var a = e("../crc32");
          function o() {
            n.call(this, "Crc32Probe");
            this.withStreamInfo("crc32", 0);
          }
          e("../utils").inherits(o, n);
          o.prototype.processChunk = function (l) {
            this.streamInfo.crc32 = a(l.data, this.streamInfo.crc32 || 0);
            this.push(l);
          };
          r.exports = o;
        }, {
          "../crc32": 4,
          "../utils": 32,
          "./GenericWorker": 28
        }],
        26: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          var a = e("./GenericWorker");
          function o(l) {
            a.call(this, "DataLengthProbe for " + l);
            this.propName = l;
            this.withStreamInfo(l, 0);
          }
          n.inherits(o, a);
          o.prototype.processChunk = function (l) {
            if (l) {
              var c = this.streamInfo[this.propName] || 0;
              this.streamInfo[this.propName] = c + l.data.length;
            }
            a.prototype.processChunk.call(this, l);
          };
          r.exports = o;
        }, {
          "../utils": 32,
          "./GenericWorker": 28
        }],
        27: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          var a = e("./GenericWorker");
          function o(l) {
            a.call(this, "DataWorker");
            var c = this;
            this.dataIsReady = false;
            this.index = 0;
            this.max = 0;
            this.data = null;
            this.type = "";
            this._tickScheduled = false;
            l.then(function (_) {
              c.dataIsReady = true;
              c.data = _;
              c.max = _ && _.length || 0;
              c.type = n.getTypeOf(_);
              if (!c.isPaused) {
                c._tickAndRepeat();
              }
            }, function (_) {
              c.error(_);
            });
          }
          n.inherits(o, a);
          o.prototype.cleanUp = function () {
            a.prototype.cleanUp.call(this);
            this.data = null;
          };
          o.prototype.resume = function () {
            return !!a.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
          };
          o.prototype._tickAndRepeat = function () {
            this._tickScheduled = false;
            if (!this.isPaused && !this.isFinished) {
              this._tick();
              if (!this.isFinished) {
                n.delay(this._tickAndRepeat, [], this);
                this._tickScheduled = true;
              }
            }
          };
          o.prototype._tick = function () {
            if (this.isPaused || this.isFinished) {
              return false;
            }
            var l = null;
            var c = Math.min(this.max, this.index + 16384);
            if (this.index >= this.max) {
              return this.end();
            }
            switch (this.type) {
              case "string":
                l = this.data.substring(this.index, c);
                break;
              case "uint8array":
                l = this.data.subarray(this.index, c);
                break;
              case "array":
              case "nodebuffer":
                l = this.data.slice(this.index, c);
            }
            this.index = c;
            return this.push({
              data: l,
              meta: {
                percent: this.max ? this.index / this.max * 100 : 0
              }
            });
          };
          r.exports = o;
        }, {
          "../utils": 32,
          "./GenericWorker": 28
        }],
        28: [function (e, r, t) {
          "use strict";

          function n(a) {
            this.name = a || "default";
            this.streamInfo = {};
            this.generatedError = null;
            this.extraStreamInfo = {};
            this.isPaused = true;
            this.isFinished = false;
            this.isLocked = false;
            this._listeners = {
              data: [],
              end: [],
              error: []
            };
            this.previous = null;
          }
          n.prototype = {
            push: function (a) {
              this.emit("data", a);
            },
            end: function () {
              if (this.isFinished) {
                return false;
              }
              this.flush();
              try {
                this.emit("end");
                this.cleanUp();
                this.isFinished = true;
              } catch (a) {
                this.emit("error", a);
              }
              return true;
            },
            error: function (a) {
              return !this.isFinished && (this.isPaused ? this.generatedError = a : (this.isFinished = true, this.emit("error", a), this.previous && this.previous.error(a), this.cleanUp()), true);
            },
            on: function (a, o) {
              this._listeners[a].push(o);
              return this;
            },
            cleanUp: function () {
              this.streamInfo = this.generatedError = this.extraStreamInfo = null;
              this._listeners = [];
            },
            emit: function (a, o) {
              if (this._listeners[a]) {
                for (var l = 0; l < this._listeners[a].length; l++) {
                  this._listeners[a][l].call(this, o);
                }
              }
            },
            pipe: function (a) {
              return a.registerPrevious(this);
            },
            registerPrevious: function (a) {
              if (this.isLocked) {
                throw new Error("The stream '" + this + "' has already been used.");
              }
              this.streamInfo = a.streamInfo;
              this.mergeStreamInfo();
              this.previous = a;
              var o = this;
              a.on("data", function (l) {
                o.processChunk(l);
              });
              a.on("end", function () {
                o.end();
              });
              a.on("error", function (l) {
                o.error(l);
              });
              return this;
            },
            pause: function () {
              return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
            },
            resume: function () {
              if (!this.isPaused || this.isFinished) {
                return false;
              }
              var a = this.isPaused = false;
              if (this.generatedError) {
                this.error(this.generatedError);
                a = true;
              }
              if (this.previous) {
                this.previous.resume();
              }
              return !a;
            },
            flush: function () {},
            processChunk: function (a) {
              this.push(a);
            },
            withStreamInfo: function (a, o) {
              this.extraStreamInfo[a] = o;
              this.mergeStreamInfo();
              return this;
            },
            mergeStreamInfo: function () {
              for (var a in this.extraStreamInfo) {
                if (Object.prototype.hasOwnProperty.call(this.extraStreamInfo, a)) {
                  this.streamInfo[a] = this.extraStreamInfo[a];
                }
              }
            },
            lock: function () {
              if (this.isLocked) {
                throw new Error("The stream '" + this + "' has already been used.");
              }
              this.isLocked = true;
              if (this.previous) {
                this.previous.lock();
              }
            },
            toString: function () {
              var a = "Worker " + this.name;
              if (this.previous) {
                return this.previous + " -> " + a;
              } else {
                return a;
              }
            }
          };
          r.exports = n;
        }, {}],
        29: [function (e, r, t) {
          "use strict";

          var n = e("../utils");
          var a = e("./ConvertWorker");
          var o = e("./GenericWorker");
          var l = e("../base64");
          var c = e("../support");
          var _ = e("../external");
          var u = null;
          if (c.nodestream) {
            try {
              u = e("../nodejs/NodejsStreamOutputAdapter");
            } catch {}
          }
          function m(v, g) {
            return new _.Promise(function (h, p) {
              var b = [];
              var S = v._internalType;
              var w = v._outputType;
              var A = v._mimeType;
              v.on("data", function (k, G) {
                b.push(k);
                if (g) {
                  g(G);
                }
              }).on("error", function (k) {
                b = [];
                p(k);
              }).on("end", function () {
                try {
                  var k = function (G, D, F) {
                    switch (G) {
                      case "blob":
                        return n.newBlob(n.transformTo("arraybuffer", D), F);
                      case "base64":
                        return l.encode(D);
                      default:
                        return n.transformTo(G, D);
                    }
                  }(w, function (G, D) {
                    var F;
                    var H = 0;
                    var z = null;
                    var x = 0;
                    for (F = 0; F < D.length; F++) {
                      x += D[F].length;
                    }
                    switch (G) {
                      case "string":
                        return D.join("");
                      case "array":
                        return Array.prototype.concat.apply([], D);
                      case "uint8array":
                        z = new Uint8Array(x);
                        F = 0;
                        for (; F < D.length; F++) {
                          z.set(D[F], H);
                          H += D[F].length;
                        }
                        return z;
                      case "nodebuffer":
                        return Buffer.concat(D);
                      default:
                        throw new Error("concat : unsupported type '" + G + "'");
                    }
                  }(S, b), A);
                  h(k);
                } catch (G) {
                  p(G);
                }
                b = [];
              }).resume();
            });
          }
          function f(v, g, h) {
            var p = g;
            switch (g) {
              case "blob":
              case "arraybuffer":
                p = "uint8array";
                break;
              case "base64":
                p = "string";
            }
            try {
              this._internalType = p;
              this._outputType = g;
              this._mimeType = h;
              n.checkSupport(p);
              this._worker = v.pipe(new a(p));
              v.lock();
            } catch (b) {
              this._worker = new o("error");
              this._worker.error(b);
            }
          }
          f.prototype = {
            accumulate: function (v) {
              return m(this, v);
            },
            on: function (v, g) {
              var h = this;
              if (v === "data") {
                this._worker.on(v, function (p) {
                  g.call(h, p.data, p.meta);
                });
              } else {
                this._worker.on(v, function () {
                  n.delay(g, arguments, h);
                });
              }
              return this;
            },
            resume: function () {
              n.delay(this._worker.resume, [], this._worker);
              return this;
            },
            pause: function () {
              this._worker.pause();
              return this;
            },
            toNodejsStream: function (v) {
              n.checkSupport("nodestream");
              if (this._outputType !== "nodebuffer") {
                throw new Error(this._outputType + " is not supported by this method");
              }
              return new u(this, {
                objectMode: this._outputType !== "nodebuffer"
              }, v);
            }
          };
          r.exports = f;
        }, {
          "../base64": 1,
          "../external": 6,
          "../nodejs/NodejsStreamOutputAdapter": 13,
          "../support": 30,
          "../utils": 32,
          "./ConvertWorker": 24,
          "./GenericWorker": 28
        }],
        30: [function (e, r, t) {
          "use strict";

          t.base64 = true;
          t.array = true;
          t.string = true;
          t.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
          t.nodebuffer = typeof Buffer !== "undefined";
          t.uint8array = typeof Uint8Array !== "undefined";
          if (typeof ArrayBuffer === "undefined") {
            t.blob = false;
          } else {
            var n = new ArrayBuffer(0);
            try {
              t.blob = new Blob([n], {
                type: "application/zip"
              }).size === 0;
            } catch {
              try {
                var a = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                a.append(n);
                t.blob = a.getBlob("application/zip").size === 0;
              } catch {
                t.blob = false;
              }
            }
          }
          try {
            t.nodestream = !!e("readable-stream").Readable;
          } catch {
            t.nodestream = false;
          }
        }, {
          "readable-stream": 16
        }],
        31: [function (e, r, t) {
          "use strict";

          var n = e("./utils");
          var a = e("./support");
          var o = e("./nodejsUtils");
          var l = e("./stream/GenericWorker");
          var c = new Array(256);
          for (var _ = 0; _ < 256; _++) {
            c[_] = _ >= 252 ? 6 : _ >= 248 ? 5 : _ >= 240 ? 4 : _ >= 224 ? 3 : _ >= 192 ? 2 : 1;
          }
          c[254] = c[254] = 1;
          function u() {
            l.call(this, "utf-8 decode");
            this.leftOver = null;
          }
          function m() {
            l.call(this, "utf-8 encode");
          }
          t.utf8encode = function (f) {
            if (a.nodebuffer) {
              return o.newBufferFrom(f, "utf-8");
            } else {
              return function (v) {
                var g;
                var h;
                var p;
                var b;
                var S;
                var w = v.length;
                var A = 0;
                for (b = 0; b < w; b++) {
                  if (((h = v.charCodeAt(b)) & 64512) == 55296 && b + 1 < w && ((p = v.charCodeAt(b + 1)) & 64512) == 56320) {
                    h = 65536 + (h - 55296 << 10) + (p - 56320);
                    b++;
                  }
                  A += h < 128 ? 1 : h < 2048 ? 2 : h < 65536 ? 3 : 4;
                }
                g = a.uint8array ? new Uint8Array(A) : new Array(A);
                b = S = 0;
                for (; S < A; b++) {
                  if (((h = v.charCodeAt(b)) & 64512) == 55296 && b + 1 < w && ((p = v.charCodeAt(b + 1)) & 64512) == 56320) {
                    h = 65536 + (h - 55296 << 10) + (p - 56320);
                    b++;
                  }
                  if (h < 128) {
                    g[S++] = h;
                  } else {
                    if (h < 2048) {
                      g[S++] = h >>> 6 | 192;
                    } else {
                      if (h < 65536) {
                        g[S++] = h >>> 12 | 224;
                      } else {
                        g[S++] = h >>> 18 | 240;
                        g[S++] = h >>> 12 & 63 | 128;
                      }
                      g[S++] = h >>> 6 & 63 | 128;
                    }
                    g[S++] = h & 63 | 128;
                  }
                }
                return g;
              }(f);
            }
          };
          t.utf8decode = function (f) {
            if (a.nodebuffer) {
              return n.transformTo("nodebuffer", f).toString("utf-8");
            } else {
              return function (v) {
                var g;
                var h;
                var p;
                var b;
                var S = v.length;
                var w = new Array(S * 2);
                for (g = h = 0; g < S;) {
                  if ((p = v[g++]) < 128) {
                    w[h++] = p;
                  } else if ((b = c[p]) > 4) {
                    w[h++] = 65533;
                    g += b - 1;
                  } else {
                    for (p &= b === 2 ? 31 : b === 3 ? 15 : 7; b > 1 && g < S;) {
                      p = p << 6 | v[g++] & 63;
                      b--;
                    }
                    if (b > 1) {
                      w[h++] = 65533;
                    } else if (p < 65536) {
                      w[h++] = p;
                    } else {
                      p -= 65536;
                      w[h++] = p >> 10 & 1023 | 55296;
                      w[h++] = p & 1023 | 56320;
                    }
                  }
                }
                if (w.length !== h) {
                  if (w.subarray) {
                    w = w.subarray(0, h);
                  } else {
                    w.length = h;
                  }
                }
                return n.applyFromCharCode(w);
              }(f = n.transformTo(a.uint8array ? "uint8array" : "array", f));
            }
          };
          n.inherits(u, l);
          u.prototype.processChunk = function (f) {
            var v = n.transformTo(a.uint8array ? "uint8array" : "array", f.data);
            if (this.leftOver && this.leftOver.length) {
              if (a.uint8array) {
                var g = v;
                (v = new Uint8Array(g.length + this.leftOver.length)).set(this.leftOver, 0);
                v.set(g, this.leftOver.length);
              } else {
                v = this.leftOver.concat(v);
              }
              this.leftOver = null;
            }
            var h = function (b, S) {
              var w;
              if ((S = S || b.length) > b.length) {
                S = b.length;
              }
              w = S - 1;
              while (w >= 0 && (b[w] & 192) == 128) {
                w--;
              }
              if (w < 0 || w === 0) {
                return S;
              } else if (w + c[b[w]] > S) {
                return w;
              } else {
                return S;
              }
            }(v);
            var p = v;
            if (h !== v.length) {
              if (a.uint8array) {
                p = v.subarray(0, h);
                this.leftOver = v.subarray(h, v.length);
              } else {
                p = v.slice(0, h);
                this.leftOver = v.slice(h, v.length);
              }
            }
            this.push({
              data: t.utf8decode(p),
              meta: f.meta
            });
          };
          u.prototype.flush = function () {
            if (this.leftOver && this.leftOver.length) {
              this.push({
                data: t.utf8decode(this.leftOver),
                meta: {}
              });
              this.leftOver = null;
            }
          };
          t.Utf8DecodeWorker = u;
          n.inherits(m, l);
          m.prototype.processChunk = function (f) {
            this.push({
              data: t.utf8encode(f.data),
              meta: f.meta
            });
          };
          t.Utf8EncodeWorker = m;
        }, {
          "./nodejsUtils": 14,
          "./stream/GenericWorker": 28,
          "./support": 30,
          "./utils": 32
        }],
        32: [function (e, r, t) {
          "use strict";

          var n = e("./support");
          var a = e("./base64");
          var o = e("./nodejsUtils");
          var l = e("./external");
          function c(g) {
            return g;
          }
          function _(g, h) {
            for (var p = 0; p < g.length; ++p) {
              h[p] = g.charCodeAt(p) & 255;
            }
            return h;
          }
          e("setimmediate");
          t.newBlob = function (g, h) {
            t.checkSupport("blob");
            try {
              return new Blob([g], {
                type: h
              });
            } catch {
              try {
                var p = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                p.append(g);
                return p.getBlob(h);
              } catch {
                throw new Error("Bug : can't construct the Blob.");
              }
            }
          };
          var u = {
            stringifyByChunk: function (g, h, p) {
              var b = [];
              var S = 0;
              var w = g.length;
              if (w <= p) {
                return String.fromCharCode.apply(null, g);
              }
              while (S < w) {
                if (h === "array" || h === "nodebuffer") {
                  b.push(String.fromCharCode.apply(null, g.slice(S, Math.min(S + p, w))));
                } else {
                  b.push(String.fromCharCode.apply(null, g.subarray(S, Math.min(S + p, w))));
                }
                S += p;
              }
              return b.join("");
            },
            stringifyByChar: function (g) {
              var h = "";
              for (var p = 0; p < g.length; p++) {
                h += String.fromCharCode(g[p]);
              }
              return h;
            },
            applyCanBeUsed: {
              uint8array: function () {
                try {
                  return n.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
                } catch {
                  return false;
                }
              }(),
              nodebuffer: function () {
                try {
                  return n.nodebuffer && String.fromCharCode.apply(null, o.allocBuffer(1)).length === 1;
                } catch {
                  return false;
                }
              }()
            }
          };
          function m(g) {
            var h = 65536;
            var p = t.getTypeOf(g);
            var b = true;
            if (p === "uint8array") {
              b = u.applyCanBeUsed.uint8array;
            } else if (p === "nodebuffer") {
              b = u.applyCanBeUsed.nodebuffer;
            }
            if (b) {
              while (h > 1) {
                try {
                  return u.stringifyByChunk(g, p, h);
                } catch {
                  h = Math.floor(h / 2);
                }
              }
            }
            return u.stringifyByChar(g);
          }
          function f(g, h) {
            for (var p = 0; p < g.length; p++) {
              h[p] = g[p];
            }
            return h;
          }
          t.applyFromCharCode = m;
          var v = {};
          v.string = {
            string: c,
            array: function (g) {
              return _(g, new Array(g.length));
            },
            arraybuffer: function (g) {
              return v.string.uint8array(g).buffer;
            },
            uint8array: function (g) {
              return _(g, new Uint8Array(g.length));
            },
            nodebuffer: function (g) {
              return _(g, o.allocBuffer(g.length));
            }
          };
          v.array = {
            string: m,
            array: c,
            arraybuffer: function (g) {
              return new Uint8Array(g).buffer;
            },
            uint8array: function (g) {
              return new Uint8Array(g);
            },
            nodebuffer: function (g) {
              return o.newBufferFrom(g);
            }
          };
          v.arraybuffer = {
            string: function (g) {
              return m(new Uint8Array(g));
            },
            array: function (g) {
              return f(new Uint8Array(g), new Array(g.byteLength));
            },
            arraybuffer: c,
            uint8array: function (g) {
              return new Uint8Array(g);
            },
            nodebuffer: function (g) {
              return o.newBufferFrom(new Uint8Array(g));
            }
          };
          v.uint8array = {
            string: m,
            array: function (g) {
              return f(g, new Array(g.length));
            },
            arraybuffer: function (g) {
              return g.buffer;
            },
            uint8array: c,
            nodebuffer: function (g) {
              return o.newBufferFrom(g);
            }
          };
          v.nodebuffer = {
            string: m,
            array: function (g) {
              return f(g, new Array(g.length));
            },
            arraybuffer: function (g) {
              return v.nodebuffer.uint8array(g).buffer;
            },
            uint8array: function (g) {
              return f(g, new Uint8Array(g.length));
            },
            nodebuffer: c
          };
          t.transformTo = function (g, h) {
            h = h || "";
            if (!g) {
              return h;
            }
            t.checkSupport(g);
            var p = t.getTypeOf(h);
            return v[p][g](h);
          };
          t.resolve = function (g) {
            for (var h = g.split("/"), p = [], b = 0; b < h.length; b++) {
              var S = h[b];
              if (S !== "." && (S !== "" || b === 0 || b === h.length - 1)) {
                if (S === "..") {
                  p.pop();
                } else {
                  p.push(S);
                }
              }
            }
            return p.join("/");
          };
          t.getTypeOf = function (g) {
            if (typeof g == "string") {
              return "string";
            } else if (Object.prototype.toString.call(g) === "[object Array]") {
              return "array";
            } else if (n.nodebuffer && o.isBuffer(g)) {
              return "nodebuffer";
            } else if (n.uint8array && g instanceof Uint8Array) {
              return "uint8array";
            } else if (n.arraybuffer && g instanceof ArrayBuffer) {
              return "arraybuffer";
            } else {
              return undefined;
            }
          };
          t.checkSupport = function (g) {
            if (!n[g.toLowerCase()]) {
              throw new Error(g + " is not supported by this platform");
            }
          };
          t.MAX_VALUE_16BITS = 65535;
          t.MAX_VALUE_32BITS = -1;
          t.pretty = function (g) {
            var h;
            var p;
            var b = "";
            for (p = 0; p < (g || "").length; p++) {
              b += "\\x" + ((h = g.charCodeAt(p)) < 16 ? "0" : "") + h.toString(16).toUpperCase();
            }
            return b;
          };
          t.delay = function (g, h, p) {
            setImmediate(function () {
              g.apply(p || null, h || []);
            });
          };
          t.inherits = function (g, h) {
            function p() {}
            p.prototype = h.prototype;
            g.prototype = new p();
          };
          t.extend = function () {
            var g;
            var h;
            var p = {};
            for (g = 0; g < arguments.length; g++) {
              for (h in arguments[g]) {
                if (Object.prototype.hasOwnProperty.call(arguments[g], h) && p[h] === undefined) {
                  p[h] = arguments[g][h];
                }
              }
            }
            return p;
          };
          t.prepareContent = function (g, h, p, b, S) {
            return l.Promise.resolve(h).then(function (w) {
              if (n.blob && (w instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(w)) !== -1) && typeof FileReader !== "undefined") {
                return new l.Promise(function (A, k) {
                  var G = new FileReader();
                  G.onload = function (D) {
                    A(D.target.result);
                  };
                  G.onerror = function (D) {
                    k(D.target.error);
                  };
                  G.readAsArrayBuffer(w);
                });
              } else {
                return w;
              }
            }).then(function (w) {
              var A = t.getTypeOf(w);
              if (A) {
                if (A === "arraybuffer") {
                  w = t.transformTo("uint8array", w);
                } else if (A === "string") {
                  if (S) {
                    w = a.decode(w);
                  } else if (p && b !== true) {
                    w = function (k) {
                      return _(k, n.uint8array ? new Uint8Array(k.length) : new Array(k.length));
                    }(w);
                  }
                }
                return w;
              } else {
                return l.Promise.reject(new Error("Can't read the data of '" + g + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
              }
            });
          };
        }, {
          "./base64": 1,
          "./external": 6,
          "./nodejsUtils": 14,
          "./support": 30,
          setimmediate: 54
        }],
        33: [function (e, r, t) {
          "use strict";

          var n = e("./reader/readerFor");
          var a = e("./utils");
          var o = e("./signature");
          var l = e("./zipEntry");
          var c = e("./support");
          function _(u) {
            this.files = [];
            this.loadOptions = u;
          }
          _.prototype = {
            checkSignature: function (u) {
              if (!this.reader.readAndCheckSignature(u)) {
                this.reader.index -= 4;
                var m = this.reader.readString(4);
                throw new Error("Corrupted zip or bug: unexpected signature (" + a.pretty(m) + ", expected " + a.pretty(u) + ")");
              }
            },
            isSignature: function (u, m) {
              var f = this.reader.index;
              this.reader.setIndex(u);
              var v = this.reader.readString(4) === m;
              this.reader.setIndex(f);
              return v;
            },
            readBlockEndOfCentral: function () {
              this.diskNumber = this.reader.readInt(2);
              this.diskWithCentralDirStart = this.reader.readInt(2);
              this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
              this.centralDirRecords = this.reader.readInt(2);
              this.centralDirSize = this.reader.readInt(4);
              this.centralDirOffset = this.reader.readInt(4);
              this.zipCommentLength = this.reader.readInt(2);
              var u = this.reader.readData(this.zipCommentLength);
              var m = c.uint8array ? "uint8array" : "array";
              var f = a.transformTo(m, u);
              this.zipComment = this.loadOptions.decodeFileName(f);
            },
            readBlockZip64EndOfCentral: function () {
              this.zip64EndOfCentralSize = this.reader.readInt(8);
              this.reader.skip(4);
              this.diskNumber = this.reader.readInt(4);
              this.diskWithCentralDirStart = this.reader.readInt(4);
              this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
              this.centralDirRecords = this.reader.readInt(8);
              this.centralDirSize = this.reader.readInt(8);
              this.centralDirOffset = this.reader.readInt(8);
              this.zip64ExtensibleData = {};
              var u;
              var m;
              var f;
              for (var v = this.zip64EndOfCentralSize - 44; v > 0;) {
                u = this.reader.readInt(2);
                m = this.reader.readInt(4);
                f = this.reader.readData(m);
                this.zip64ExtensibleData[u] = {
                  id: u,
                  length: m,
                  value: f
                };
              }
            },
            readBlockZip64EndOfCentralLocator: function () {
              this.diskWithZip64CentralDirStart = this.reader.readInt(4);
              this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
              this.disksCount = this.reader.readInt(4);
              if (this.disksCount > 1) {
                throw new Error("Multi-volumes zip are not supported");
              }
            },
            readLocalFiles: function () {
              var u;
              var m;
              for (u = 0; u < this.files.length; u++) {
                m = this.files[u];
                this.reader.setIndex(m.localHeaderOffset);
                this.checkSignature(o.LOCAL_FILE_HEADER);
                m.readLocalPart(this.reader);
                m.handleUTF8();
                m.processAttributes();
              }
            },
            readCentralDir: function () {
              var u;
              for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(o.CENTRAL_FILE_HEADER);) {
                (u = new l({
                  zip64: this.zip64
                }, this.loadOptions)).readCentralPart(this.reader);
                this.files.push(u);
              }
              if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0) {
                throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
              }
            },
            readEndOfCentral: function () {
              var u = this.reader.lastIndexOfSignature(o.CENTRAL_DIRECTORY_END);
              if (u < 0) {
                throw this.isSignature(0, o.LOCAL_FILE_HEADER) ? new Error("Corrupted zip: can't find end of central directory") : new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
              }
              this.reader.setIndex(u);
              var m = u;
              this.checkSignature(o.CENTRAL_DIRECTORY_END);
              this.readBlockEndOfCentral();
              if (this.diskNumber === a.MAX_VALUE_16BITS || this.diskWithCentralDirStart === a.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === a.MAX_VALUE_16BITS || this.centralDirRecords === a.MAX_VALUE_16BITS || this.centralDirSize === a.MAX_VALUE_32BITS || this.centralDirOffset === a.MAX_VALUE_32BITS) {
                this.zip64 = true;
                if ((u = this.reader.lastIndexOfSignature(o.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) {
                  throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
                }
                this.reader.setIndex(u);
                this.checkSignature(o.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
                this.readBlockZip64EndOfCentralLocator();
                if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, o.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(o.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) {
                  throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
                }
                this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
                this.checkSignature(o.ZIP64_CENTRAL_DIRECTORY_END);
                this.readBlockZip64EndOfCentral();
              }
              var f = this.centralDirOffset + this.centralDirSize;
              if (this.zip64) {
                f += 20;
                f += 12 + this.zip64EndOfCentralSize;
              }
              var v = m - f;
              if (v > 0) {
                if (!this.isSignature(m, o.CENTRAL_FILE_HEADER)) {
                  this.reader.zero = v;
                }
              } else if (v < 0) {
                throw new Error("Corrupted zip: missing " + Math.abs(v) + " bytes.");
              }
            },
            prepareReader: function (u) {
              this.reader = n(u);
            },
            load: function (u) {
              this.prepareReader(u);
              this.readEndOfCentral();
              this.readCentralDir();
              this.readLocalFiles();
            }
          };
          r.exports = _;
        }, {
          "./reader/readerFor": 22,
          "./signature": 23,
          "./support": 30,
          "./utils": 32,
          "./zipEntry": 34
        }],
        34: [function (e, r, t) {
          "use strict";

          var n = e("./reader/readerFor");
          var a = e("./utils");
          var o = e("./compressedObject");
          var l = e("./crc32");
          var c = e("./utf8");
          var _ = e("./compressions");
          var u = e("./support");
          function m(f, v) {
            this.options = f;
            this.loadOptions = v;
          }
          m.prototype = {
            isEncrypted: function () {
              return (this.bitFlag & 1) == 1;
            },
            useUTF8: function () {
              return (this.bitFlag & 2048) == 2048;
            },
            readLocalPart: function (f) {
              var v;
              var g;
              f.skip(22);
              this.fileNameLength = f.readInt(2);
              g = f.readInt(2);
              this.fileName = f.readData(this.fileNameLength);
              f.skip(g);
              if (this.compressedSize === -1 || this.uncompressedSize === -1) {
                throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
              }
              if ((v = function (h) {
                for (var p in _) {
                  if (Object.prototype.hasOwnProperty.call(_, p) && _[p].magic === h) {
                    return _[p];
                  }
                }
                return null;
              }(this.compressionMethod)) === null) {
                throw new Error("Corrupted zip : compression " + a.pretty(this.compressionMethod) + " unknown (inner file : " + a.transformTo("string", this.fileName) + ")");
              }
              this.decompressed = new o(this.compressedSize, this.uncompressedSize, this.crc32, v, f.readData(this.compressedSize));
            },
            readCentralPart: function (f) {
              this.versionMadeBy = f.readInt(2);
              f.skip(2);
              this.bitFlag = f.readInt(2);
              this.compressionMethod = f.readString(2);
              this.date = f.readDate();
              this.crc32 = f.readInt(4);
              this.compressedSize = f.readInt(4);
              this.uncompressedSize = f.readInt(4);
              var v = f.readInt(2);
              this.extraFieldsLength = f.readInt(2);
              this.fileCommentLength = f.readInt(2);
              this.diskNumberStart = f.readInt(2);
              this.internalFileAttributes = f.readInt(2);
              this.externalFileAttributes = f.readInt(4);
              this.localHeaderOffset = f.readInt(4);
              if (this.isEncrypted()) {
                throw new Error("Encrypted zip are not supported");
              }
              f.skip(v);
              this.readExtraFields(f);
              this.parseZIP64ExtraField(f);
              this.fileComment = f.readData(this.fileCommentLength);
            },
            processAttributes: function () {
              this.unixPermissions = null;
              this.dosPermissions = null;
              var f = this.versionMadeBy >> 8;
              this.dir = !!(this.externalFileAttributes & 16);
              if (f == 0) {
                this.dosPermissions = this.externalFileAttributes & 63;
              }
              if (f == 3) {
                this.unixPermissions = this.externalFileAttributes >> 16 & 65535;
              }
              if (!this.dir && this.fileNameStr.slice(-1) === "/") {
                this.dir = true;
              }
            },
            parseZIP64ExtraField: function () {
              if (this.extraFields[1]) {
                var f = n(this.extraFields[1].value);
                if (this.uncompressedSize === a.MAX_VALUE_32BITS) {
                  this.uncompressedSize = f.readInt(8);
                }
                if (this.compressedSize === a.MAX_VALUE_32BITS) {
                  this.compressedSize = f.readInt(8);
                }
                if (this.localHeaderOffset === a.MAX_VALUE_32BITS) {
                  this.localHeaderOffset = f.readInt(8);
                }
                if (this.diskNumberStart === a.MAX_VALUE_32BITS) {
                  this.diskNumberStart = f.readInt(4);
                }
              }
            },
            readExtraFields: function (f) {
              var v;
              var g;
              var h;
              var p = f.index + this.extraFieldsLength;
              for (this.extraFields ||= {}; f.index + 4 < p;) {
                v = f.readInt(2);
                g = f.readInt(2);
                h = f.readData(g);
                this.extraFields[v] = {
                  id: v,
                  length: g,
                  value: h
                };
              }
              f.setIndex(p);
            },
            handleUTF8: function () {
              var f = u.uint8array ? "uint8array" : "array";
              if (this.useUTF8()) {
                this.fileNameStr = c.utf8decode(this.fileName);
                this.fileCommentStr = c.utf8decode(this.fileComment);
              } else {
                var v = this.findExtraFieldUnicodePath();
                if (v !== null) {
                  this.fileNameStr = v;
                } else {
                  var g = a.transformTo(f, this.fileName);
                  this.fileNameStr = this.loadOptions.decodeFileName(g);
                }
                var h = this.findExtraFieldUnicodeComment();
                if (h !== null) {
                  this.fileCommentStr = h;
                } else {
                  var p = a.transformTo(f, this.fileComment);
                  this.fileCommentStr = this.loadOptions.decodeFileName(p);
                }
              }
            },
            findExtraFieldUnicodePath: function () {
              var f = this.extraFields[28789];
              if (f) {
                var v = n(f.value);
                if (v.readInt(1) !== 1 || l(this.fileName) !== v.readInt(4)) {
                  return null;
                } else {
                  return c.utf8decode(v.readData(f.length - 5));
                }
              }
              return null;
            },
            findExtraFieldUnicodeComment: function () {
              var f = this.extraFields[25461];
              if (f) {
                var v = n(f.value);
                if (v.readInt(1) !== 1 || l(this.fileComment) !== v.readInt(4)) {
                  return null;
                } else {
                  return c.utf8decode(v.readData(f.length - 5));
                }
              }
              return null;
            }
          };
          r.exports = m;
        }, {
          "./compressedObject": 2,
          "./compressions": 3,
          "./crc32": 4,
          "./reader/readerFor": 22,
          "./support": 30,
          "./utf8": 31,
          "./utils": 32
        }],
        35: [function (e, r, t) {
          "use strict";

          function n(v, g, h) {
            this.name = v;
            this.dir = h.dir;
            this.date = h.date;
            this.comment = h.comment;
            this.unixPermissions = h.unixPermissions;
            this.dosPermissions = h.dosPermissions;
            this._data = g;
            this._dataBinary = h.binary;
            this.options = {
              compression: h.compression,
              compressionOptions: h.compressionOptions
            };
          }
          var a = e("./stream/StreamHelper");
          var o = e("./stream/DataWorker");
          var l = e("./utf8");
          var c = e("./compressedObject");
          var _ = e("./stream/GenericWorker");
          n.prototype = {
            internalStream: function (v) {
              var g = null;
              var h = "string";
              try {
                if (!v) {
                  throw new Error("No output type specified.");
                }
                var p = (h = v.toLowerCase()) === "string" || h === "text";
                if (h === "binarystring" || h === "text") {
                  h = "string";
                }
                g = this._decompressWorker();
                var b = !this._dataBinary;
                if (b && !p) {
                  g = g.pipe(new l.Utf8EncodeWorker());
                }
                if (!b && p) {
                  g = g.pipe(new l.Utf8DecodeWorker());
                }
              } catch (S) {
                (g = new _("error")).error(S);
              }
              return new a(g, h, "");
            },
            async: function (v, g) {
              return this.internalStream(v).accumulate(g);
            },
            nodeStream: function (v, g) {
              return this.internalStream(v || "nodebuffer").toNodejsStream(g);
            },
            _compressWorker: function (v, g) {
              if (this._data instanceof c && this._data.compression.magic === v.magic) {
                return this._data.getCompressedWorker();
              }
              var h = this._decompressWorker();
              if (!this._dataBinary) {
                h = h.pipe(new l.Utf8EncodeWorker());
              }
              return c.createWorkerFrom(h, v, g);
            },
            _decompressWorker: function () {
              if (this._data instanceof c) {
                return this._data.getContentWorker();
              } else if (this._data instanceof _) {
                return this._data;
              } else {
                return new o(this._data);
              }
            }
          };
          for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], m = function () {
              throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
            }, f = 0; f < u.length; f++) {
            n.prototype[u[f]] = m;
          }
          r.exports = n;
        }, {
          "./compressedObject": 2,
          "./stream/DataWorker": 27,
          "./stream/GenericWorker": 28,
          "./stream/StreamHelper": 29,
          "./utf8": 31
        }],
        36: [function (e, r, t) {
          (function (n) {
            "use strict";

            var a;
            var o;
            var l = n.MutationObserver || n.WebKitMutationObserver;
            if (l) {
              var c = 0;
              var _ = new l(v);
              var u = n.document.createTextNode("");
              _.observe(u, {
                characterData: true
              });
              a = function () {
                u.data = c = ++c % 2;
              };
            } else if (n.setImmediate || n.MessageChannel === undefined) {
              a = "document" in n && "onreadystatechange" in n.document.createElement("script") ? function () {
                var g = n.document.createElement("script");
                g.onreadystatechange = function () {
                  v();
                  g.onreadystatechange = null;
                  g.parentNode.removeChild(g);
                  g = null;
                };
                n.document.documentElement.appendChild(g);
              } : function () {
                setTimeout(v, 0);
              };
            } else {
              var m = new n.MessageChannel();
              m.port1.onmessage = v;
              a = function () {
                m.port2.postMessage(0);
              };
            }
            var f = [];
            function v() {
              var g;
              var h;
              o = true;
              for (var p = f.length; p;) {
                h = f;
                f = [];
                g = -1;
                while (++g < p) {
                  h[g]();
                }
                p = f.length;
              }
              o = false;
            }
            r.exports = function (g) {
              if (f.push(g) === 1 && !o) {
                a();
              }
            };
          }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
        }, {}],
        37: [function (e, r, t) {
          "use strict";

          var n = e("immediate");
          function a() {}
          var o = {};
          var l = ["REJECTED"];
          var c = ["FULFILLED"];
          var _ = ["PENDING"];
          function u(p) {
            if (typeof p != "function") {
              throw new TypeError("resolver must be a function");
            }
            this.state = _;
            this.queue = [];
            this.outcome = undefined;
            if (p !== a) {
              g(this, p);
            }
          }
          function m(p, b, S) {
            this.promise = p;
            if (typeof b == "function") {
              this.onFulfilled = b;
              this.callFulfilled = this.otherCallFulfilled;
            }
            if (typeof S == "function") {
              this.onRejected = S;
              this.callRejected = this.otherCallRejected;
            }
          }
          function f(p, b, S) {
            n(function () {
              var w;
              try {
                w = b(S);
              } catch (A) {
                return o.reject(p, A);
              }
              if (w === p) {
                o.reject(p, new TypeError("Cannot resolve promise with itself"));
              } else {
                o.resolve(p, w);
              }
            });
          }
          function v(p) {
            var b = p && p.then;
            if (p && (typeof p == "object" || typeof p == "function") && typeof b == "function") {
              return function () {
                b.apply(p, arguments);
              };
            }
          }
          function g(p, b) {
            var S = false;
            function w(G) {
              if (!S) {
                S = true;
                o.reject(p, G);
              }
            }
            function A(G) {
              if (!S) {
                S = true;
                o.resolve(p, G);
              }
            }
            var k = h(function () {
              b(A, w);
            });
            if (k.status === "error") {
              w(k.value);
            }
          }
          function h(p, b) {
            var S = {};
            try {
              S.value = p(b);
              S.status = "success";
            } catch (w) {
              S.status = "error";
              S.value = w;
            }
            return S;
          }
          (r.exports = u).prototype.finally = function (p) {
            if (typeof p != "function") {
              return this;
            }
            var b = this.constructor;
            return this.then(function (S) {
              return b.resolve(p()).then(function () {
                return S;
              });
            }, function (S) {
              return b.resolve(p()).then(function () {
                throw S;
              });
            });
          };
          u.prototype.catch = function (p) {
            return this.then(null, p);
          };
          u.prototype.then = function (p, b) {
            if (typeof p != "function" && this.state === c || typeof b != "function" && this.state === l) {
              return this;
            }
            var S = new this.constructor(a);
            if (this.state !== _) {
              f(S, this.state === c ? p : b, this.outcome);
            } else {
              this.queue.push(new m(S, p, b));
            }
            return S;
          };
          m.prototype.callFulfilled = function (p) {
            o.resolve(this.promise, p);
          };
          m.prototype.otherCallFulfilled = function (p) {
            f(this.promise, this.onFulfilled, p);
          };
          m.prototype.callRejected = function (p) {
            o.reject(this.promise, p);
          };
          m.prototype.otherCallRejected = function (p) {
            f(this.promise, this.onRejected, p);
          };
          o.resolve = function (p, b) {
            var S = h(v, b);
            if (S.status === "error") {
              return o.reject(p, S.value);
            }
            var w = S.value;
            if (w) {
              g(p, w);
            } else {
              p.state = c;
              p.outcome = b;
              for (var A = -1, k = p.queue.length; ++A < k;) {
                p.queue[A].callFulfilled(b);
              }
            }
            return p;
          };
          o.reject = function (p, b) {
            p.state = l;
            p.outcome = b;
            for (var S = -1, w = p.queue.length; ++S < w;) {
              p.queue[S].callRejected(b);
            }
            return p;
          };
          u.resolve = function (p) {
            if (p instanceof this) {
              return p;
            } else {
              return o.resolve(new this(a), p);
            }
          };
          u.reject = function (p) {
            var b = new this(a);
            return o.reject(b, p);
          };
          u.all = function (p) {
            var b = this;
            if (Object.prototype.toString.call(p) !== "[object Array]") {
              return this.reject(new TypeError("must be an array"));
            }
            var S = p.length;
            var w = false;
            if (!S) {
              return this.resolve([]);
            }
            var A = new Array(S);
            var k = 0;
            for (var G = -1, D = new this(a); ++G < S;) {
              F(p[G], G);
            }
            return D;
            function F(H, z) {
              b.resolve(H).then(function (x) {
                A[z] = x;
                if (++k === S && !w) {
                  w = true;
                  o.resolve(D, A);
                }
              }, function (x) {
                if (!w) {
                  w = true;
                  o.reject(D, x);
                }
              });
            }
          };
          u.race = function (p) {
            var b = this;
            if (Object.prototype.toString.call(p) !== "[object Array]") {
              return this.reject(new TypeError("must be an array"));
            }
            var S = p.length;
            var w = false;
            if (!S) {
              return this.resolve([]);
            }
            for (var A = -1, k = new this(a); ++A < S;) {
              G = p[A];
              b.resolve(G).then(function (D) {
                if (!w) {
                  w = true;
                  o.resolve(k, D);
                }
              }, function (D) {
                if (!w) {
                  w = true;
                  o.reject(k, D);
                }
              });
            }
            var G;
            return k;
          };
        }, {
          immediate: 36
        }],
        38: [function (e, r, t) {
          "use strict";

          var n = {};
          (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants"));
          r.exports = n;
        }, {
          "./lib/deflate": 39,
          "./lib/inflate": 40,
          "./lib/utils/common": 41,
          "./lib/zlib/constants": 44
        }],
        39: [function (e, r, t) {
          "use strict";

          var n = e("./zlib/deflate");
          var a = e("./utils/common");
          var o = e("./utils/strings");
          var l = e("./zlib/messages");
          var c = e("./zlib/zstream");
          var _ = Object.prototype.toString;
          var u = 0;
          var m = -1;
          var f = 0;
          var v = 8;
          function g(p) {
            if (!(this instanceof g)) {
              return new g(p);
            }
            this.options = a.assign({
              level: m,
              method: v,
              chunkSize: 16384,
              windowBits: 15,
              memLevel: 8,
              strategy: f,
              to: ""
            }, p || {});
            var b = this.options;
            if (b.raw && b.windowBits > 0) {
              b.windowBits = -b.windowBits;
            } else if (b.gzip && b.windowBits > 0 && b.windowBits < 16) {
              b.windowBits += 16;
            }
            this.err = 0;
            this.msg = "";
            this.ended = false;
            this.chunks = [];
            this.strm = new c();
            this.strm.avail_out = 0;
            var S = n.deflateInit2(this.strm, b.level, b.method, b.windowBits, b.memLevel, b.strategy);
            if (S !== u) {
              throw new Error(l[S]);
            }
            if (b.header) {
              n.deflateSetHeader(this.strm, b.header);
            }
            if (b.dictionary) {
              var w;
              w = typeof b.dictionary == "string" ? o.string2buf(b.dictionary) : _.call(b.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(b.dictionary) : b.dictionary;
              if ((S = n.deflateSetDictionary(this.strm, w)) !== u) {
                throw new Error(l[S]);
              }
              this._dict_set = true;
            }
          }
          function h(p, b) {
            var S = new g(b);
            S.push(p, true);
            if (S.err) {
              throw S.msg || l[S.err];
            }
            return S.result;
          }
          g.prototype.push = function (p, b) {
            var S;
            var w;
            var A = this.strm;
            var k = this.options.chunkSize;
            if (this.ended) {
              return false;
            }
            w = b === ~~b ? b : b === true ? 4 : 0;
            if (typeof p == "string") {
              A.input = o.string2buf(p);
            } else if (_.call(p) === "[object ArrayBuffer]") {
              A.input = new Uint8Array(p);
            } else {
              A.input = p;
            }
            A.next_in = 0;
            A.avail_in = A.input.length;
            do {
              if (A.avail_out === 0) {
                A.output = new a.Buf8(k);
                A.next_out = 0;
                A.avail_out = k;
              }
              if ((S = n.deflate(A, w)) !== 1 && S !== u) {
                this.onEnd(S);
                return !(this.ended = true);
              }
              if (A.avail_out === 0 || A.avail_in === 0 && (w === 4 || w === 2)) {
                if (this.options.to === "string") {
                  this.onData(o.buf2binstring(a.shrinkBuf(A.output, A.next_out)));
                } else {
                  this.onData(a.shrinkBuf(A.output, A.next_out));
                }
              }
            } while ((A.avail_in > 0 || A.avail_out === 0) && S !== 1);
            if (w === 4) {
              S = n.deflateEnd(this.strm);
              this.onEnd(S);
              this.ended = true;
              return S === u;
            } else {
              return w !== 2 || (this.onEnd(u), !(A.avail_out = 0));
            }
          };
          g.prototype.onData = function (p) {
            this.chunks.push(p);
          };
          g.prototype.onEnd = function (p) {
            if (p === u) {
              if (this.options.to === "string") {
                this.result = this.chunks.join("");
              } else {
                this.result = a.flattenChunks(this.chunks);
              }
            }
            this.chunks = [];
            this.err = p;
            this.msg = this.strm.msg;
          };
          t.Deflate = g;
          t.deflate = h;
          t.deflateRaw = function (p, b) {
            (b = b || {}).raw = true;
            return h(p, b);
          };
          t.gzip = function (p, b) {
            (b = b || {}).gzip = true;
            return h(p, b);
          };
        }, {
          "./utils/common": 41,
          "./utils/strings": 42,
          "./zlib/deflate": 46,
          "./zlib/messages": 51,
          "./zlib/zstream": 53
        }],
        40: [function (e, r, t) {
          "use strict";

          var n = e("./zlib/inflate");
          var a = e("./utils/common");
          var o = e("./utils/strings");
          var l = e("./zlib/constants");
          var c = e("./zlib/messages");
          var _ = e("./zlib/zstream");
          var u = e("./zlib/gzheader");
          var m = Object.prototype.toString;
          function f(g) {
            if (!(this instanceof f)) {
              return new f(g);
            }
            this.options = a.assign({
              chunkSize: 16384,
              windowBits: 0,
              to: ""
            }, g || {});
            var h = this.options;
            if (h.raw && h.windowBits >= 0 && h.windowBits < 16) {
              h.windowBits = -h.windowBits;
              if (h.windowBits === 0) {
                h.windowBits = -15;
              }
            }
            if (!!(h.windowBits >= 0) && !!(h.windowBits < 16) && (!g || !g.windowBits)) {
              h.windowBits += 32;
            }
            if (h.windowBits > 15 && h.windowBits < 48 && (h.windowBits & 15) == 0) {
              h.windowBits |= 15;
            }
            this.err = 0;
            this.msg = "";
            this.ended = false;
            this.chunks = [];
            this.strm = new _();
            this.strm.avail_out = 0;
            var p = n.inflateInit2(this.strm, h.windowBits);
            if (p !== l.Z_OK) {
              throw new Error(c[p]);
            }
            this.header = new u();
            n.inflateGetHeader(this.strm, this.header);
          }
          function v(g, h) {
            var p = new f(h);
            p.push(g, true);
            if (p.err) {
              throw p.msg || c[p.err];
            }
            return p.result;
          }
          f.prototype.push = function (g, h) {
            var p;
            var b;
            var S;
            var w;
            var A;
            var k;
            var G = this.strm;
            var D = this.options.chunkSize;
            var F = this.options.dictionary;
            var H = false;
            if (this.ended) {
              return false;
            }
            b = h === ~~h ? h : h === true ? l.Z_FINISH : l.Z_NO_FLUSH;
            if (typeof g == "string") {
              G.input = o.binstring2buf(g);
            } else if (m.call(g) === "[object ArrayBuffer]") {
              G.input = new Uint8Array(g);
            } else {
              G.input = g;
            }
            G.next_in = 0;
            G.avail_in = G.input.length;
            do {
              if (G.avail_out === 0) {
                G.output = new a.Buf8(D);
                G.next_out = 0;
                G.avail_out = D;
              }
              if ((p = n.inflate(G, l.Z_NO_FLUSH)) === l.Z_NEED_DICT && F) {
                k = typeof F == "string" ? o.string2buf(F) : m.call(F) === "[object ArrayBuffer]" ? new Uint8Array(F) : F;
                p = n.inflateSetDictionary(this.strm, k);
              }
              if (p === l.Z_BUF_ERROR && H === true) {
                p = l.Z_OK;
                H = false;
              }
              if (p !== l.Z_STREAM_END && p !== l.Z_OK) {
                this.onEnd(p);
                return !(this.ended = true);
              }
              if (G.next_out) {
                if (G.avail_out === 0 || p === l.Z_STREAM_END || G.avail_in === 0 && (b === l.Z_FINISH || b === l.Z_SYNC_FLUSH)) {
                  if (this.options.to === "string") {
                    S = o.utf8border(G.output, G.next_out);
                    w = G.next_out - S;
                    A = o.buf2string(G.output, S);
                    G.next_out = w;
                    G.avail_out = D - w;
                    if (w) {
                      a.arraySet(G.output, G.output, S, w, 0);
                    }
                    this.onData(A);
                  } else {
                    this.onData(a.shrinkBuf(G.output, G.next_out));
                  }
                }
              }
              if (G.avail_in === 0 && G.avail_out === 0) {
                H = true;
              }
            } while ((G.avail_in > 0 || G.avail_out === 0) && p !== l.Z_STREAM_END);
            if (p === l.Z_STREAM_END) {
              b = l.Z_FINISH;
            }
            if (b === l.Z_FINISH) {
              p = n.inflateEnd(this.strm);
              this.onEnd(p);
              this.ended = true;
              return p === l.Z_OK;
            } else {
              return b !== l.Z_SYNC_FLUSH || (this.onEnd(l.Z_OK), !(G.avail_out = 0));
            }
          };
          f.prototype.onData = function (g) {
            this.chunks.push(g);
          };
          f.prototype.onEnd = function (g) {
            if (g === l.Z_OK) {
              if (this.options.to === "string") {
                this.result = this.chunks.join("");
              } else {
                this.result = a.flattenChunks(this.chunks);
              }
            }
            this.chunks = [];
            this.err = g;
            this.msg = this.strm.msg;
          };
          t.Inflate = f;
          t.inflate = v;
          t.inflateRaw = function (g, h) {
            (h = h || {}).raw = true;
            return v(g, h);
          };
          t.ungzip = v;
        }, {
          "./utils/common": 41,
          "./utils/strings": 42,
          "./zlib/constants": 44,
          "./zlib/gzheader": 47,
          "./zlib/inflate": 49,
          "./zlib/messages": 51,
          "./zlib/zstream": 53
        }],
        41: [function (e, r, t) {
          "use strict";

          var n = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
          t.assign = function (l) {
            for (var c = Array.prototype.slice.call(arguments, 1); c.length;) {
              var _ = c.shift();
              if (_) {
                if (typeof _ != "object") {
                  throw new TypeError(_ + "must be non-object");
                }
                for (var u in _) {
                  if (_.hasOwnProperty(u)) {
                    l[u] = _[u];
                  }
                }
              }
            }
            return l;
          };
          t.shrinkBuf = function (l, c) {
            if (l.length === c) {
              return l;
            } else if (l.subarray) {
              return l.subarray(0, c);
            } else {
              l.length = c;
              return l;
            }
          };
          var a = {
            arraySet: function (l, c, _, u, m) {
              if (c.subarray && l.subarray) {
                l.set(c.subarray(_, _ + u), m);
              } else {
                for (var f = 0; f < u; f++) {
                  l[m + f] = c[_ + f];
                }
              }
            },
            flattenChunks: function (l) {
              var c;
              var _;
              var u;
              var m;
              var f;
              var v;
              c = u = 0;
              _ = l.length;
              for (; c < _; c++) {
                u += l[c].length;
              }
              v = new Uint8Array(u);
              c = m = 0;
              _ = l.length;
              for (; c < _; c++) {
                f = l[c];
                v.set(f, m);
                m += f.length;
              }
              return v;
            }
          };
          var o = {
            arraySet: function (l, c, _, u, m) {
              for (var f = 0; f < u; f++) {
                l[m + f] = c[_ + f];
              }
            },
            flattenChunks: function (l) {
              return [].concat.apply([], l);
            }
          };
          t.setTyped = function (l) {
            if (l) {
              t.Buf8 = Uint8Array;
              t.Buf16 = Uint16Array;
              t.Buf32 = Int32Array;
              t.assign(t, a);
            } else {
              t.Buf8 = Array;
              t.Buf16 = Array;
              t.Buf32 = Array;
              t.assign(t, o);
            }
          };
          t.setTyped(n);
        }, {}],
        42: [function (e, r, t) {
          "use strict";

          var n = e("./common");
          var a = true;
          var o = true;
          try {
            String.fromCharCode.apply(null, [0]);
          } catch {
            a = false;
          }
          try {
            String.fromCharCode.apply(null, new Uint8Array(1));
          } catch {
            o = false;
          }
          var l = new n.Buf8(256);
          for (var c = 0; c < 256; c++) {
            l[c] = c >= 252 ? 6 : c >= 248 ? 5 : c >= 240 ? 4 : c >= 224 ? 3 : c >= 192 ? 2 : 1;
          }
          function _(u, m) {
            if (m < 65537 && (u.subarray && o || !u.subarray && a)) {
              return String.fromCharCode.apply(null, n.shrinkBuf(u, m));
            }
            var f = "";
            for (var v = 0; v < m; v++) {
              f += String.fromCharCode(u[v]);
            }
            return f;
          }
          l[254] = l[254] = 1;
          t.string2buf = function (u) {
            var m;
            var f;
            var v;
            var g;
            var h;
            var p = u.length;
            var b = 0;
            for (g = 0; g < p; g++) {
              if (((f = u.charCodeAt(g)) & 64512) == 55296 && g + 1 < p && ((v = u.charCodeAt(g + 1)) & 64512) == 56320) {
                f = 65536 + (f - 55296 << 10) + (v - 56320);
                g++;
              }
              b += f < 128 ? 1 : f < 2048 ? 2 : f < 65536 ? 3 : 4;
            }
            m = new n.Buf8(b);
            g = h = 0;
            for (; h < b; g++) {
              if (((f = u.charCodeAt(g)) & 64512) == 55296 && g + 1 < p && ((v = u.charCodeAt(g + 1)) & 64512) == 56320) {
                f = 65536 + (f - 55296 << 10) + (v - 56320);
                g++;
              }
              if (f < 128) {
                m[h++] = f;
              } else {
                if (f < 2048) {
                  m[h++] = f >>> 6 | 192;
                } else {
                  if (f < 65536) {
                    m[h++] = f >>> 12 | 224;
                  } else {
                    m[h++] = f >>> 18 | 240;
                    m[h++] = f >>> 12 & 63 | 128;
                  }
                  m[h++] = f >>> 6 & 63 | 128;
                }
                m[h++] = f & 63 | 128;
              }
            }
            return m;
          };
          t.buf2binstring = function (u) {
            return _(u, u.length);
          };
          t.binstring2buf = function (u) {
            var m = new n.Buf8(u.length);
            for (var f = 0, v = m.length; f < v; f++) {
              m[f] = u.charCodeAt(f);
            }
            return m;
          };
          t.buf2string = function (u, m) {
            var f;
            var v;
            var g;
            var h;
            var p = m || u.length;
            var b = new Array(p * 2);
            for (f = v = 0; f < p;) {
              if ((g = u[f++]) < 128) {
                b[v++] = g;
              } else if ((h = l[g]) > 4) {
                b[v++] = 65533;
                f += h - 1;
              } else {
                for (g &= h === 2 ? 31 : h === 3 ? 15 : 7; h > 1 && f < p;) {
                  g = g << 6 | u[f++] & 63;
                  h--;
                }
                if (h > 1) {
                  b[v++] = 65533;
                } else if (g < 65536) {
                  b[v++] = g;
                } else {
                  g -= 65536;
                  b[v++] = g >> 10 & 1023 | 55296;
                  b[v++] = g & 1023 | 56320;
                }
              }
            }
            return _(b, v);
          };
          t.utf8border = function (u, m) {
            var f;
            if ((m = m || u.length) > u.length) {
              m = u.length;
            }
            f = m - 1;
            while (f >= 0 && (u[f] & 192) == 128) {
              f--;
            }
            if (f < 0 || f === 0) {
              return m;
            } else if (f + l[u[f]] > m) {
              return f;
            } else {
              return m;
            }
          };
        }, {
          "./common": 41
        }],
        43: [function (e, r, t) {
          "use strict";

          r.exports = function (n, a, o, l) {
            var c = n & 65535 | 0;
            var _ = n >>> 16 & 65535 | 0;
            var u = 0;
            for (; o !== 0;) {
              for (o -= u = o > 2000 ? 2000 : o; _ = _ + (c = c + a[l++] | 0) | 0, --u;);
              c %= 65521;
              _ %= 65521;
            }
            return c | _ << 16 | 0;
          };
        }, {}],
        44: [function (e, r, t) {
          "use strict";

          r.exports = {
            Z_NO_FLUSH: 0,
            Z_PARTIAL_FLUSH: 1,
            Z_SYNC_FLUSH: 2,
            Z_FULL_FLUSH: 3,
            Z_FINISH: 4,
            Z_BLOCK: 5,
            Z_TREES: 6,
            Z_OK: 0,
            Z_STREAM_END: 1,
            Z_NEED_DICT: 2,
            Z_ERRNO: -1,
            Z_STREAM_ERROR: -2,
            Z_DATA_ERROR: -3,
            Z_BUF_ERROR: -5,
            Z_NO_COMPRESSION: 0,
            Z_BEST_SPEED: 1,
            Z_BEST_COMPRESSION: 9,
            Z_DEFAULT_COMPRESSION: -1,
            Z_FILTERED: 1,
            Z_HUFFMAN_ONLY: 2,
            Z_RLE: 3,
            Z_FIXED: 4,
            Z_DEFAULT_STRATEGY: 0,
            Z_BINARY: 0,
            Z_TEXT: 1,
            Z_UNKNOWN: 2,
            Z_DEFLATED: 8
          };
        }, {}],
        45: [function (e, r, t) {
          "use strict";

          var n = function () {
            var a;
            var o = [];
            for (var l = 0; l < 256; l++) {
              a = l;
              for (var c = 0; c < 8; c++) {
                a = a & 1 ? a >>> 1 ^ -306674912 : a >>> 1;
              }
              o[l] = a;
            }
            return o;
          }();
          r.exports = function (a, o, l, c) {
            var _ = n;
            var u = c + l;
            a ^= -1;
            for (var m = c; m < u; m++) {
              a = a >>> 8 ^ _[(a ^ o[m]) & 255];
            }
            return a ^ -1;
          };
        }, {}],
        46: [function (e, r, t) {
          "use strict";

          var n;
          var a = e("../utils/common");
          var o = e("./trees");
          var l = e("./adler32");
          var c = e("./crc32");
          var _ = e("./messages");
          var u = 0;
          var m = 4;
          var f = 0;
          var v = -2;
          var g = -1;
          var h = 4;
          var p = 2;
          var b = 8;
          var S = 9;
          var w = 286;
          var A = 30;
          var k = 19;
          var G = w * 2 + 1;
          var D = 15;
          var F = 3;
          var H = 258;
          var z = H + F + 1;
          var x = 42;
          var I = 113;
          var E = 1;
          var M = 2;
          var Z = 3;
          var N = 4;
          function $(d, R) {
            d.msg = _[R];
            return R;
          }
          function O(d) {
            return (d << 1) - (d > 4 ? 9 : 0);
          }
          function J(d) {
            for (var R = d.length; --R >= 0;) {
              d[R] = 0;
            }
          }
          function B(d) {
            var R = d.state;
            var U = R.pending;
            if (U > d.avail_out) {
              U = d.avail_out;
            }
            if (U !== 0) {
              a.arraySet(d.output, R.pending_buf, R.pending_out, U, d.next_out);
              d.next_out += U;
              R.pending_out += U;
              d.total_out += U;
              d.avail_out -= U;
              R.pending -= U;
              if (R.pending === 0) {
                R.pending_out = 0;
              }
            }
          }
          function T(d, R) {
            o._tr_flush_block(d, d.block_start >= 0 ? d.block_start : -1, d.strstart - d.block_start, R);
            d.block_start = d.strstart;
            B(d.strm);
          }
          function K(d, R) {
            d.pending_buf[d.pending++] = R;
          }
          function q(d, R) {
            d.pending_buf[d.pending++] = R >>> 8 & 255;
            d.pending_buf[d.pending++] = R & 255;
          }
          function X(d, R) {
            var U;
            var L;
            var y = d.max_chain_length;
            var C = d.strstart;
            var W = d.prev_length;
            var V = d.nice_match;
            var P = d.strstart > d.w_size - z ? d.strstart - (d.w_size - z) : 0;
            var j = d.window;
            var Y = d.w_mask;
            var Q = d.prev;
            var ee = d.strstart + H;
            var ie = j[C + W - 1];
            var te = j[C + W];
            if (d.prev_length >= d.good_match) {
              y >>= 2;
            }
            if (V > d.lookahead) {
              V = d.lookahead;
            }
            do {
              if (j[(U = R) + W] === te && j[U + W - 1] === ie && j[U] === j[C] && j[++U] === j[C + 1]) {
                C += 2;
                U++;
                do ; while (j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && j[++C] === j[++U] && C < ee);
                L = H - (ee - C);
                C = ee - H;
                if (W < L) {
                  d.match_start = R;
                  if (V <= (W = L)) {
                    break;
                  }
                  ie = j[C + W - 1];
                  te = j[C + W];
                }
              }
            } while ((R = Q[R & Y]) > P && --y != 0);
            if (W <= d.lookahead) {
              return W;
            } else {
              return d.lookahead;
            }
          }
          function ae(d) {
            var R;
            var U;
            var L;
            var y;
            var C;
            var W;
            var V;
            var P;
            var j;
            var Y;
            var Q = d.w_size;
            do {
              y = d.window_size - d.lookahead - d.strstart;
              if (d.strstart >= Q + (Q - z)) {
                a.arraySet(d.window, d.window, Q, Q, 0);
                d.match_start -= Q;
                d.strstart -= Q;
                d.block_start -= Q;
                R = U = d.hash_size;
                while (L = d.head[--R], d.head[R] = Q <= L ? L - Q : 0, --U);
                for (R = U = Q; L = d.prev[--R], d.prev[R] = Q <= L ? L - Q : 0, --U;);
                y += Q;
              }
              if (d.strm.avail_in === 0) {
                break;
              }
              W = d.strm;
              V = d.window;
              P = d.strstart + d.lookahead;
              j = y;
              Y = undefined;
              Y = W.avail_in;
              if (j < Y) {
                Y = j;
              }
              U = Y === 0 ? 0 : (W.avail_in -= Y, a.arraySet(V, W.input, W.next_in, Y, P), W.state.wrap === 1 ? W.adler = l(W.adler, V, Y, P) : W.state.wrap === 2 && (W.adler = c(W.adler, V, Y, P)), W.next_in += Y, W.total_in += Y, Y);
              d.lookahead += U;
              if (d.lookahead + d.insert >= F) {
                C = d.strstart - d.insert;
                d.ins_h = d.window[C];
                d.ins_h = (d.ins_h << d.hash_shift ^ d.window[C + 1]) & d.hash_mask;
                while (d.insert && (d.ins_h = (d.ins_h << d.hash_shift ^ d.window[C + F - 1]) & d.hash_mask, d.prev[C & d.w_mask] = d.head[d.ins_h], d.head[d.ins_h] = C, C++, d.insert--, !(d.lookahead + d.insert < F)));
              }
            } while (d.lookahead < z && d.strm.avail_in !== 0);
          }
          function ce(d, R) {
            var U;
            var L;
            while (true) {
              if (d.lookahead < z) {
                ae(d);
                if (d.lookahead < z && R === u) {
                  return E;
                }
                if (d.lookahead === 0) {
                  break;
                }
              }
              U = 0;
              if (d.lookahead >= F) {
                d.ins_h = (d.ins_h << d.hash_shift ^ d.window[d.strstart + F - 1]) & d.hash_mask;
                U = d.prev[d.strstart & d.w_mask] = d.head[d.ins_h];
                d.head[d.ins_h] = d.strstart;
              }
              if (U !== 0 && d.strstart - U <= d.w_size - z) {
                d.match_length = X(d, U);
              }
              if (d.match_length >= F) {
                L = o._tr_tally(d, d.strstart - d.match_start, d.match_length - F);
                d.lookahead -= d.match_length;
                if (d.match_length <= d.max_lazy_match && d.lookahead >= F) {
                  for (d.match_length--; d.strstart++, d.ins_h = (d.ins_h << d.hash_shift ^ d.window[d.strstart + F - 1]) & d.hash_mask, U = d.prev[d.strstart & d.w_mask] = d.head[d.ins_h], d.head[d.ins_h] = d.strstart, --d.match_length != 0;);
                  d.strstart++;
                } else {
                  d.strstart += d.match_length;
                  d.match_length = 0;
                  d.ins_h = d.window[d.strstart];
                  d.ins_h = (d.ins_h << d.hash_shift ^ d.window[d.strstart + 1]) & d.hash_mask;
                }
              } else {
                L = o._tr_tally(d, 0, d.window[d.strstart]);
                d.lookahead--;
                d.strstart++;
              }
              if (L && (T(d, false), d.strm.avail_out === 0)) {
                return E;
              }
            }
            d.insert = d.strstart < F - 1 ? d.strstart : F - 1;
            if (R === m) {
              T(d, true);
              if (d.strm.avail_out === 0) {
                return Z;
              } else {
                return N;
              }
            } else if (d.last_lit && (T(d, false), d.strm.avail_out === 0)) {
              return E;
            } else {
              return M;
            }
          }
          function re(d, R) {
            var U;
            var L;
            var y;
            while (true) {
              if (d.lookahead < z) {
                ae(d);
                if (d.lookahead < z && R === u) {
                  return E;
                }
                if (d.lookahead === 0) {
                  break;
                }
              }
              U = 0;
              if (d.lookahead >= F) {
                d.ins_h = (d.ins_h << d.hash_shift ^ d.window[d.strstart + F - 1]) & d.hash_mask;
                U = d.prev[d.strstart & d.w_mask] = d.head[d.ins_h];
                d.head[d.ins_h] = d.strstart;
              }
              d.prev_length = d.match_length;
              d.prev_match = d.match_start;
              d.match_length = F - 1;
              if (U !== 0 && d.prev_length < d.max_lazy_match && d.strstart - U <= d.w_size - z) {
                d.match_length = X(d, U);
                if (d.match_length <= 5 && (d.strategy === 1 || d.match_length === F && d.strstart - d.match_start > 4096)) {
                  d.match_length = F - 1;
                }
              }
              if (d.prev_length >= F && d.match_length <= d.prev_length) {
                y = d.strstart + d.lookahead - F;
                L = o._tr_tally(d, d.strstart - 1 - d.prev_match, d.prev_length - F);
                d.lookahead -= d.prev_length - 1;
                d.prev_length -= 2;
                while (++d.strstart <= y && (d.ins_h = (d.ins_h << d.hash_shift ^ d.window[d.strstart + F - 1]) & d.hash_mask, U = d.prev[d.strstart & d.w_mask] = d.head[d.ins_h], d.head[d.ins_h] = d.strstart), --d.prev_length != 0);
                d.match_available = 0;
                d.match_length = F - 1;
                d.strstart++;
                if (L && (T(d, false), d.strm.avail_out === 0)) {
                  return E;
                }
              } else if (d.match_available) {
                if (L = o._tr_tally(d, 0, d.window[d.strstart - 1])) {
                  T(d, false);
                }
                d.strstart++;
                d.lookahead--;
                if (d.strm.avail_out === 0) {
                  return E;
                }
              } else {
                d.match_available = 1;
                d.strstart++;
                d.lookahead--;
              }
            }
            if (d.match_available) {
              L = o._tr_tally(d, 0, d.window[d.strstart - 1]);
              d.match_available = 0;
            }
            d.insert = d.strstart < F - 1 ? d.strstart : F - 1;
            if (R === m) {
              T(d, true);
              if (d.strm.avail_out === 0) {
                return Z;
              } else {
                return N;
              }
            } else if (d.last_lit && (T(d, false), d.strm.avail_out === 0)) {
              return E;
            } else {
              return M;
            }
          }
          function ne(d, R, U, L, y) {
            this.good_length = d;
            this.max_lazy = R;
            this.nice_length = U;
            this.max_chain = L;
            this.func = y;
          }
          function se() {
            this.strm = null;
            this.status = 0;
            this.pending_buf = null;
            this.pending_buf_size = 0;
            this.pending_out = 0;
            this.pending = 0;
            this.wrap = 0;
            this.gzhead = null;
            this.gzindex = 0;
            this.method = b;
            this.last_flush = -1;
            this.w_size = 0;
            this.w_bits = 0;
            this.w_mask = 0;
            this.window = null;
            this.window_size = 0;
            this.prev = null;
            this.head = null;
            this.ins_h = 0;
            this.hash_size = 0;
            this.hash_bits = 0;
            this.hash_mask = 0;
            this.hash_shift = 0;
            this.block_start = 0;
            this.match_length = 0;
            this.prev_match = 0;
            this.match_available = 0;
            this.strstart = 0;
            this.match_start = 0;
            this.lookahead = 0;
            this.prev_length = 0;
            this.max_chain_length = 0;
            this.max_lazy_match = 0;
            this.level = 0;
            this.strategy = 0;
            this.good_match = 0;
            this.nice_match = 0;
            this.dyn_ltree = new a.Buf16(G * 2);
            this.dyn_dtree = new a.Buf16((A * 2 + 1) * 2);
            this.bl_tree = new a.Buf16((k * 2 + 1) * 2);
            J(this.dyn_ltree);
            J(this.dyn_dtree);
            J(this.bl_tree);
            this.l_desc = null;
            this.d_desc = null;
            this.bl_desc = null;
            this.bl_count = new a.Buf16(D + 1);
            this.heap = new a.Buf16(w * 2 + 1);
            J(this.heap);
            this.heap_len = 0;
            this.heap_max = 0;
            this.depth = new a.Buf16(w * 2 + 1);
            J(this.depth);
            this.l_buf = 0;
            this.lit_bufsize = 0;
            this.last_lit = 0;
            this.d_buf = 0;
            this.opt_len = 0;
            this.static_len = 0;
            this.matches = 0;
            this.insert = 0;
            this.bi_buf = 0;
            this.bi_valid = 0;
          }
          function oe(d) {
            var R;
            if (d && d.state) {
              d.total_in = d.total_out = 0;
              d.data_type = p;
              (R = d.state).pending = 0;
              R.pending_out = 0;
              if (R.wrap < 0) {
                R.wrap = -R.wrap;
              }
              R.status = R.wrap ? x : I;
              d.adler = R.wrap === 2 ? 0 : 1;
              R.last_flush = u;
              o._tr_init(R);
              return f;
            } else {
              return $(d, v);
            }
          }
          function fe(d) {
            var R = oe(d);
            if (R === f) {
              (function (U) {
                U.window_size = U.w_size * 2;
                J(U.head);
                U.max_lazy_match = n[U.level].max_lazy;
                U.good_match = n[U.level].good_length;
                U.nice_match = n[U.level].nice_length;
                U.max_chain_length = n[U.level].max_chain;
                U.strstart = 0;
                U.block_start = 0;
                U.lookahead = 0;
                U.insert = 0;
                U.match_length = U.prev_length = F - 1;
                U.match_available = 0;
                U.ins_h = 0;
              })(d.state);
            }
            return R;
          }
          function ue(d, R, U, L, y, C) {
            if (!d) {
              return v;
            }
            var W = 1;
            if (R === g) {
              R = 6;
            }
            if (L < 0) {
              W = 0;
              L = -L;
            } else if (L > 15) {
              W = 2;
              L -= 16;
            }
            if (y < 1 || S < y || U !== b || L < 8 || L > 15 || R < 0 || R > 9 || C < 0 || h < C) {
              return $(d, v);
            }
            if (L === 8) {
              L = 9;
            }
            var V = new se();
            (d.state = V).strm = d;
            V.wrap = W;
            V.gzhead = null;
            V.w_bits = L;
            V.w_size = 1 << V.w_bits;
            V.w_mask = V.w_size - 1;
            V.hash_bits = y + 7;
            V.hash_size = 1 << V.hash_bits;
            V.hash_mask = V.hash_size - 1;
            V.hash_shift = ~~((V.hash_bits + F - 1) / F);
            V.window = new a.Buf8(V.w_size * 2);
            V.head = new a.Buf16(V.hash_size);
            V.prev = new a.Buf16(V.w_size);
            V.lit_bufsize = 1 << y + 6;
            V.pending_buf_size = V.lit_bufsize * 4;
            V.pending_buf = new a.Buf8(V.pending_buf_size);
            V.d_buf = V.lit_bufsize * 1;
            V.l_buf = V.lit_bufsize * 3;
            V.level = R;
            V.strategy = C;
            V.method = U;
            return fe(d);
          }
          n = [new ne(0, 0, 0, 0, function (d, R) {
            var U = 65535;
            for (U > d.pending_buf_size - 5 && (U = d.pending_buf_size - 5);;) {
              if (d.lookahead <= 1) {
                ae(d);
                if (d.lookahead === 0 && R === u) {
                  return E;
                }
                if (d.lookahead === 0) {
                  break;
                }
              }
              d.strstart += d.lookahead;
              d.lookahead = 0;
              var L = d.block_start + U;
              if ((d.strstart === 0 || d.strstart >= L) && (d.lookahead = d.strstart - L, d.strstart = L, T(d, false), d.strm.avail_out === 0) || d.strstart - d.block_start >= d.w_size - z && (T(d, false), d.strm.avail_out === 0)) {
                return E;
              }
            }
            d.insert = 0;
            if (R === m) {
              T(d, true);
              if (d.strm.avail_out === 0) {
                return Z;
              } else {
                return N;
              }
            } else {
              if (d.strstart > d.block_start) {
                T(d, false);
                d.strm.avail_out;
              }
              return E;
            }
          }), new ne(4, 4, 8, 4, ce), new ne(4, 5, 16, 8, ce), new ne(4, 6, 32, 32, ce), new ne(4, 4, 16, 16, re), new ne(8, 16, 32, 32, re), new ne(8, 16, 128, 128, re), new ne(8, 32, 128, 256, re), new ne(32, 128, 258, 1024, re), new ne(32, 258, 258, 4096, re)];
          t.deflateInit = function (d, R) {
            return ue(d, R, b, 15, 8, 0);
          };
          t.deflateInit2 = ue;
          t.deflateReset = fe;
          t.deflateResetKeep = oe;
          t.deflateSetHeader = function (d, R) {
            if (d && d.state) {
              if (d.state.wrap !== 2) {
                return v;
              } else {
                d.state.gzhead = R;
                return f;
              }
            } else {
              return v;
            }
          };
          t.deflate = function (d, R) {
            var U;
            var L;
            var y;
            var C;
            if (!d || !d.state || R > 5 || R < 0) {
              if (d) {
                return $(d, v);
              } else {
                return v;
              }
            }
            L = d.state;
            if (!d.output || !d.input && d.avail_in !== 0 || L.status === 666 && R !== m) {
              return $(d, d.avail_out === 0 ? -5 : v);
            }
            L.strm = d;
            U = L.last_flush;
            L.last_flush = R;
            if (L.status === x) {
              if (L.wrap === 2) {
                d.adler = 0;
                K(L, 31);
                K(L, 139);
                K(L, 8);
                if (L.gzhead) {
                  K(L, (L.gzhead.text ? 1 : 0) + (L.gzhead.hcrc ? 2 : 0) + (L.gzhead.extra ? 4 : 0) + (L.gzhead.name ? 8 : 0) + (L.gzhead.comment ? 16 : 0));
                  K(L, L.gzhead.time & 255);
                  K(L, L.gzhead.time >> 8 & 255);
                  K(L, L.gzhead.time >> 16 & 255);
                  K(L, L.gzhead.time >> 24 & 255);
                  K(L, L.level === 9 ? 2 : L.strategy >= 2 || L.level < 2 ? 4 : 0);
                  K(L, L.gzhead.os & 255);
                  if (L.gzhead.extra && L.gzhead.extra.length) {
                    K(L, L.gzhead.extra.length & 255);
                    K(L, L.gzhead.extra.length >> 8 & 255);
                  }
                  if (L.gzhead.hcrc) {
                    d.adler = c(d.adler, L.pending_buf, L.pending, 0);
                  }
                  L.gzindex = 0;
                  L.status = 69;
                } else {
                  K(L, 0);
                  K(L, 0);
                  K(L, 0);
                  K(L, 0);
                  K(L, 0);
                  K(L, L.level === 9 ? 2 : L.strategy >= 2 || L.level < 2 ? 4 : 0);
                  K(L, 3);
                  L.status = I;
                }
              } else {
                var W = b + (L.w_bits - 8 << 4) << 8;
                W |= (L.strategy >= 2 || L.level < 2 ? 0 : L.level < 6 ? 1 : L.level === 6 ? 2 : 3) << 6;
                if (L.strstart !== 0) {
                  W |= 32;
                }
                W += 31 - W % 31;
                L.status = I;
                q(L, W);
                if (L.strstart !== 0) {
                  q(L, d.adler >>> 16);
                  q(L, d.adler & 65535);
                }
                d.adler = 1;
              }
            }
            if (L.status === 69) {
              if (L.gzhead.extra) {
                for (y = L.pending; L.gzindex < (L.gzhead.extra.length & 65535) && (L.pending !== L.pending_buf_size || (L.gzhead.hcrc && L.pending > y && (d.adler = c(d.adler, L.pending_buf, L.pending - y, y)), B(d), y = L.pending, L.pending !== L.pending_buf_size));) {
                  K(L, L.gzhead.extra[L.gzindex] & 255);
                  L.gzindex++;
                }
                if (L.gzhead.hcrc && L.pending > y) {
                  d.adler = c(d.adler, L.pending_buf, L.pending - y, y);
                }
                if (L.gzindex === L.gzhead.extra.length) {
                  L.gzindex = 0;
                  L.status = 73;
                }
              } else {
                L.status = 73;
              }
            }
            if (L.status === 73) {
              if (L.gzhead.name) {
                y = L.pending;
                do {
                  if (L.pending === L.pending_buf_size && (L.gzhead.hcrc && L.pending > y && (d.adler = c(d.adler, L.pending_buf, L.pending - y, y)), B(d), y = L.pending, L.pending === L.pending_buf_size)) {
                    C = 1;
                    break;
                  }
                  C = L.gzindex < L.gzhead.name.length ? L.gzhead.name.charCodeAt(L.gzindex++) & 255 : 0;
                  K(L, C);
                } while (C !== 0);
                if (L.gzhead.hcrc && L.pending > y) {
                  d.adler = c(d.adler, L.pending_buf, L.pending - y, y);
                }
                if (C === 0) {
                  L.gzindex = 0;
                  L.status = 91;
                }
              } else {
                L.status = 91;
              }
            }
            if (L.status === 91) {
              if (L.gzhead.comment) {
                y = L.pending;
                do {
                  if (L.pending === L.pending_buf_size && (L.gzhead.hcrc && L.pending > y && (d.adler = c(d.adler, L.pending_buf, L.pending - y, y)), B(d), y = L.pending, L.pending === L.pending_buf_size)) {
                    C = 1;
                    break;
                  }
                  C = L.gzindex < L.gzhead.comment.length ? L.gzhead.comment.charCodeAt(L.gzindex++) & 255 : 0;
                  K(L, C);
                } while (C !== 0);
                if (L.gzhead.hcrc && L.pending > y) {
                  d.adler = c(d.adler, L.pending_buf, L.pending - y, y);
                }
                if (C === 0) {
                  L.status = 103;
                }
              } else {
                L.status = 103;
              }
            }
            if (L.status === 103) {
              if (L.gzhead.hcrc) {
                if (L.pending + 2 > L.pending_buf_size) {
                  B(d);
                }
                if (L.pending + 2 <= L.pending_buf_size) {
                  K(L, d.adler & 255);
                  K(L, d.adler >> 8 & 255);
                  d.adler = 0;
                  L.status = I;
                }
              } else {
                L.status = I;
              }
            }
            if (L.pending !== 0) {
              B(d);
              if (d.avail_out === 0) {
                L.last_flush = -1;
                return f;
              }
            } else if (d.avail_in === 0 && O(R) <= O(U) && R !== m) {
              return $(d, -5);
            }
            if (L.status === 666 && d.avail_in !== 0) {
              return $(d, -5);
            }
            if (d.avail_in !== 0 || L.lookahead !== 0 || R !== u && L.status !== 666) {
              var V = L.strategy === 2 ? function (P, j) {
                var Y;
                for (;;) {
                  if (P.lookahead === 0 && (ae(P), P.lookahead === 0)) {
                    if (j === u) {
                      return E;
                    }
                    break;
                  }
                  P.match_length = 0;
                  Y = o._tr_tally(P, 0, P.window[P.strstart]);
                  P.lookahead--;
                  P.strstart++;
                  if (Y && (T(P, false), P.strm.avail_out === 0)) {
                    return E;
                  }
                }
                P.insert = 0;
                if (j === m) {
                  T(P, true);
                  if (P.strm.avail_out === 0) {
                    return Z;
                  } else {
                    return N;
                  }
                } else if (P.last_lit && (T(P, false), P.strm.avail_out === 0)) {
                  return E;
                } else {
                  return M;
                }
              }(L, R) : L.strategy === 3 ? function (P, j) {
                var Y;
                var Q;
                var ee;
                var ie;
                var te = P.window;
                while (true) {
                  if (P.lookahead <= H) {
                    ae(P);
                    if (P.lookahead <= H && j === u) {
                      return E;
                    }
                    if (P.lookahead === 0) {
                      break;
                    }
                  }
                  P.match_length = 0;
                  if (P.lookahead >= F && P.strstart > 0 && (Q = te[ee = P.strstart - 1]) === te[++ee] && Q === te[++ee] && Q === te[++ee]) {
                    ie = P.strstart + H;
                    do ; while (Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && Q === te[++ee] && ee < ie);
                    P.match_length = H - (ie - ee);
                    if (P.match_length > P.lookahead) {
                      P.match_length = P.lookahead;
                    }
                  }
                  if (P.match_length >= F) {
                    Y = o._tr_tally(P, 1, P.match_length - F);
                    P.lookahead -= P.match_length;
                    P.strstart += P.match_length;
                    P.match_length = 0;
                  } else {
                    Y = o._tr_tally(P, 0, P.window[P.strstart]);
                    P.lookahead--;
                    P.strstart++;
                  }
                  if (Y && (T(P, false), P.strm.avail_out === 0)) {
                    return E;
                  }
                }
                P.insert = 0;
                if (j === m) {
                  T(P, true);
                  if (P.strm.avail_out === 0) {
                    return Z;
                  } else {
                    return N;
                  }
                } else if (P.last_lit && (T(P, false), P.strm.avail_out === 0)) {
                  return E;
                } else {
                  return M;
                }
              }(L, R) : n[L.level].func(L, R);
              if (V === Z || V === N) {
                L.status = 666;
              }
              if (V === E || V === Z) {
                if (d.avail_out === 0) {
                  L.last_flush = -1;
                }
                return f;
              }
              if (V === M && (R === 1 ? o._tr_align(L) : R !== 5 && (o._tr_stored_block(L, 0, 0, false), R === 3 && (J(L.head), L.lookahead === 0 && (L.strstart = 0, L.block_start = 0, L.insert = 0))), B(d), d.avail_out === 0)) {
                L.last_flush = -1;
                return f;
              }
            }
            if (R !== m) {
              return f;
            } else if (L.wrap <= 0) {
              return 1;
            } else {
              if (L.wrap === 2) {
                K(L, d.adler & 255);
                K(L, d.adler >> 8 & 255);
                K(L, d.adler >> 16 & 255);
                K(L, d.adler >> 24 & 255);
                K(L, d.total_in & 255);
                K(L, d.total_in >> 8 & 255);
                K(L, d.total_in >> 16 & 255);
                K(L, d.total_in >> 24 & 255);
              } else {
                q(L, d.adler >>> 16);
                q(L, d.adler & 65535);
              }
              B(d);
              if (L.wrap > 0) {
                L.wrap = -L.wrap;
              }
              if (L.pending !== 0) {
                return f;
              } else {
                return 1;
              }
            }
          };
          t.deflateEnd = function (d) {
            var R;
            if (d && d.state) {
              if ((R = d.state.status) !== x && R !== 69 && R !== 73 && R !== 91 && R !== 103 && R !== I && R !== 666) {
                return $(d, v);
              } else {
                d.state = null;
                if (R === I) {
                  return $(d, -3);
                } else {
                  return f;
                }
              }
            } else {
              return v;
            }
          };
          t.deflateSetDictionary = function (d, R) {
            var U;
            var L;
            var y;
            var C;
            var W;
            var V;
            var P;
            var j;
            var Y = R.length;
            if (!d || !d.state || (C = (U = d.state).wrap) === 2 || C === 1 && U.status !== x || U.lookahead) {
              return v;
            }
            if (C === 1) {
              d.adler = l(d.adler, R, Y, 0);
            }
            U.wrap = 0;
            if (Y >= U.w_size) {
              if (C === 0) {
                J(U.head);
                U.strstart = 0;
                U.block_start = 0;
                U.insert = 0;
              }
              j = new a.Buf8(U.w_size);
              a.arraySet(j, R, Y - U.w_size, U.w_size, 0);
              R = j;
              Y = U.w_size;
            }
            W = d.avail_in;
            V = d.next_in;
            P = d.input;
            d.avail_in = Y;
            d.next_in = 0;
            d.input = R;
            ae(U);
            while (U.lookahead >= F) {
              L = U.strstart;
              y = U.lookahead - (F - 1);
              while (U.ins_h = (U.ins_h << U.hash_shift ^ U.window[L + F - 1]) & U.hash_mask, U.prev[L & U.w_mask] = U.head[U.ins_h], U.head[U.ins_h] = L, L++, --y);
              U.strstart = L;
              U.lookahead = F - 1;
              ae(U);
            }
            U.strstart += U.lookahead;
            U.block_start = U.strstart;
            U.insert = U.lookahead;
            U.lookahead = 0;
            U.match_length = U.prev_length = F - 1;
            U.match_available = 0;
            d.next_in = V;
            d.input = P;
            d.avail_in = W;
            U.wrap = C;
            return f;
          };
          t.deflateInfo = "pako deflate (from Nodeca project)";
        }, {
          "../utils/common": 41,
          "./adler32": 43,
          "./crc32": 45,
          "./messages": 51,
          "./trees": 52
        }],
        47: [function (e, r, t) {
          "use strict";

          r.exports = function () {
            this.text = 0;
            this.time = 0;
            this.xflags = 0;
            this.os = 0;
            this.extra = null;
            this.extra_len = 0;
            this.name = "";
            this.comment = "";
            this.hcrc = 0;
            this.done = false;
          };
        }, {}],
        48: [function (e, r, t) {
          "use strict";

          r.exports = function (n, a) {
            var o;
            var l;
            var c;
            var _;
            var u;
            var m;
            var f;
            var v;
            var g;
            var h;
            var p;
            var b;
            var S;
            var w;
            var A;
            var k;
            var G;
            var D;
            var F;
            var H;
            var z;
            var x;
            var I;
            var E;
            var M;
            o = n.state;
            l = n.next_in;
            E = n.input;
            c = l + (n.avail_in - 5);
            _ = n.next_out;
            M = n.output;
            u = _ - (a - n.avail_out);
            m = _ + (n.avail_out - 257);
            f = o.dmax;
            v = o.wsize;
            g = o.whave;
            h = o.wnext;
            p = o.window;
            b = o.hold;
            S = o.bits;
            w = o.lencode;
            A = o.distcode;
            k = (1 << o.lenbits) - 1;
            G = (1 << o.distbits) - 1;
            e: do {
              if (S < 15) {
                b += E[l++] << S;
                S += 8;
                b += E[l++] << S;
                S += 8;
              }
              D = w[b & k];
              r: while (true) {
                b >>>= F = D >>> 24;
                S -= F;
                if ((F = D >>> 16 & 255) === 0) {
                  M[_++] = D & 65535;
                } else {
                  if (!(F & 16)) {
                    if ((F & 64) == 0) {
                      D = w[(D & 65535) + (b & (1 << F) - 1)];
                      continue r;
                    }
                    if (F & 32) {
                      o.mode = 12;
                      break e;
                    }
                    n.msg = "invalid literal/length code";
                    o.mode = 30;
                    break e;
                  }
                  H = D & 65535;
                  if (F &= 15) {
                    if (S < F) {
                      b += E[l++] << S;
                      S += 8;
                    }
                    H += b & (1 << F) - 1;
                    b >>>= F;
                    S -= F;
                  }
                  if (S < 15) {
                    b += E[l++] << S;
                    S += 8;
                    b += E[l++] << S;
                    S += 8;
                  }
                  D = A[b & G];
                  t: while (true) {
                    b >>>= F = D >>> 24;
                    S -= F;
                    if (!((F = D >>> 16 & 255) & 16)) {
                      if ((F & 64) == 0) {
                        D = A[(D & 65535) + (b & (1 << F) - 1)];
                        continue t;
                      }
                      n.msg = "invalid distance code";
                      o.mode = 30;
                      break e;
                    }
                    z = D & 65535;
                    if (S < (F &= 15)) {
                      b += E[l++] << S;
                      if ((S += 8) < F) {
                        b += E[l++] << S;
                        S += 8;
                      }
                    }
                    if (f < (z += b & (1 << F) - 1)) {
                      n.msg = "invalid distance too far back";
                      o.mode = 30;
                      break e;
                    }
                    b >>>= F;
                    S -= F;
                    if ((F = _ - u) < z) {
                      if (g < (F = z - F) && o.sane) {
                        n.msg = "invalid distance too far back";
                        o.mode = 30;
                        break e;
                      }
                      I = p;
                      if ((x = 0) === h) {
                        x += v - F;
                        if (F < H) {
                          for (H -= F; M[_++] = p[x++], --F;);
                          x = _ - z;
                          I = M;
                        }
                      } else if (h < F) {
                        x += v + h - F;
                        if ((F -= h) < H) {
                          for (H -= F; M[_++] = p[x++], --F;);
                          x = 0;
                          if (h < H) {
                            for (H -= F = h; M[_++] = p[x++], --F;);
                            x = _ - z;
                            I = M;
                          }
                        }
                      } else {
                        x += h - F;
                        if (F < H) {
                          for (H -= F; M[_++] = p[x++], --F;);
                          x = _ - z;
                          I = M;
                        }
                      }
                      while (H > 2) {
                        M[_++] = I[x++];
                        M[_++] = I[x++];
                        M[_++] = I[x++];
                        H -= 3;
                      }
                      if (H) {
                        M[_++] = I[x++];
                        if (H > 1) {
                          M[_++] = I[x++];
                        }
                      }
                    } else {
                      for (x = _ - z; M[_++] = M[x++], M[_++] = M[x++], M[_++] = M[x++], (H -= 3) > 2;);
                      if (H) {
                        M[_++] = M[x++];
                        if (H > 1) {
                          M[_++] = M[x++];
                        }
                      }
                    }
                    break;
                  }
                }
                break;
              }
            } while (l < c && _ < m);
            l -= H = S >> 3;
            b &= (1 << (S -= H << 3)) - 1;
            n.next_in = l;
            n.next_out = _;
            n.avail_in = l < c ? c - l + 5 : 5 - (l - c);
            n.avail_out = _ < m ? m - _ + 257 : 257 - (_ - m);
            o.hold = b;
            o.bits = S;
          };
        }, {}],
        49: [function (e, r, t) {
          "use strict";

          var n = e("../utils/common");
          var a = e("./adler32");
          var o = e("./crc32");
          var l = e("./inffast");
          var c = e("./inftrees");
          var _ = 1;
          var u = 2;
          var m = 0;
          var f = -2;
          var v = 1;
          var g = 852;
          var h = 592;
          function p(x) {
            return (x >>> 24 & 255) + (x >>> 8 & 65280) + ((x & 65280) << 8) + ((x & 255) << 24);
          }
          function b() {
            this.mode = 0;
            this.last = false;
            this.wrap = 0;
            this.havedict = false;
            this.flags = 0;
            this.dmax = 0;
            this.check = 0;
            this.total = 0;
            this.head = null;
            this.wbits = 0;
            this.wsize = 0;
            this.whave = 0;
            this.wnext = 0;
            this.window = null;
            this.hold = 0;
            this.bits = 0;
            this.length = 0;
            this.offset = 0;
            this.extra = 0;
            this.lencode = null;
            this.distcode = null;
            this.lenbits = 0;
            this.distbits = 0;
            this.ncode = 0;
            this.nlen = 0;
            this.ndist = 0;
            this.have = 0;
            this.next = null;
            this.lens = new n.Buf16(320);
            this.work = new n.Buf16(288);
            this.lendyn = null;
            this.distdyn = null;
            this.sane = 0;
            this.back = 0;
            this.was = 0;
          }
          function S(x) {
            var I;
            if (x && x.state) {
              I = x.state;
              x.total_in = x.total_out = I.total = 0;
              x.msg = "";
              if (I.wrap) {
                x.adler = I.wrap & 1;
              }
              I.mode = v;
              I.last = 0;
              I.havedict = 0;
              I.dmax = 32768;
              I.head = null;
              I.hold = 0;
              I.bits = 0;
              I.lencode = I.lendyn = new n.Buf32(g);
              I.distcode = I.distdyn = new n.Buf32(h);
              I.sane = 1;
              I.back = -1;
              return m;
            } else {
              return f;
            }
          }
          function w(x) {
            var I;
            if (x && x.state) {
              (I = x.state).wsize = 0;
              I.whave = 0;
              I.wnext = 0;
              return S(x);
            } else {
              return f;
            }
          }
          function A(x, I) {
            var E;
            var M;
            if (x && x.state) {
              M = x.state;
              if (I < 0) {
                E = 0;
                I = -I;
              } else {
                E = 1 + (I >> 4);
                if (I < 48) {
                  I &= 15;
                }
              }
              if (I && (I < 8 || I > 15)) {
                return f;
              } else {
                if (M.window !== null && M.wbits !== I) {
                  M.window = null;
                }
                M.wrap = E;
                M.wbits = I;
                return w(x);
              }
            } else {
              return f;
            }
          }
          function k(x, I) {
            var E;
            var M;
            if (x) {
              M = new b();
              (x.state = M).window = null;
              if ((E = A(x, I)) !== m) {
                x.state = null;
              }
              return E;
            } else {
              return f;
            }
          }
          var G;
          var D;
          var F = true;
          function H(x) {
            if (F) {
              var I;
              G = new n.Buf32(512);
              D = new n.Buf32(32);
              I = 0;
              while (I < 144) {
                x.lens[I++] = 8;
              }
              while (I < 256) {
                x.lens[I++] = 9;
              }
              while (I < 280) {
                x.lens[I++] = 7;
              }
              while (I < 288) {
                x.lens[I++] = 8;
              }
              c(_, x.lens, 0, 288, G, 0, x.work, {
                bits: 9
              });
              I = 0;
              while (I < 32) {
                x.lens[I++] = 5;
              }
              c(u, x.lens, 0, 32, D, 0, x.work, {
                bits: 5
              });
              F = false;
            }
            x.lencode = G;
            x.lenbits = 9;
            x.distcode = D;
            x.distbits = 5;
          }
          function z(x, I, E, M) {
            var Z;
            var N = x.state;
            if (N.window === null) {
              N.wsize = 1 << N.wbits;
              N.wnext = 0;
              N.whave = 0;
              N.window = new n.Buf8(N.wsize);
            }
            if (M >= N.wsize) {
              n.arraySet(N.window, I, E - N.wsize, N.wsize, 0);
              N.wnext = 0;
              N.whave = N.wsize;
            } else {
              if (M < (Z = N.wsize - N.wnext)) {
                Z = M;
              }
              n.arraySet(N.window, I, E - M, Z, N.wnext);
              if (M -= Z) {
                n.arraySet(N.window, I, E - M, M, 0);
                N.wnext = M;
                N.whave = N.wsize;
              } else {
                N.wnext += Z;
                if (N.wnext === N.wsize) {
                  N.wnext = 0;
                }
                if (N.whave < N.wsize) {
                  N.whave += Z;
                }
              }
            }
            return 0;
          }
          t.inflateReset = w;
          t.inflateReset2 = A;
          t.inflateResetKeep = S;
          t.inflateInit = function (x) {
            return k(x, 15);
          };
          t.inflateInit2 = k;
          t.inflate = function (x, I) {
            var E;
            var M;
            var Z;
            var N;
            var $;
            var O;
            var J;
            var B;
            var T;
            var K;
            var q;
            var X;
            var ae;
            var ce;
            var re;
            var ne;
            var se;
            var oe;
            var fe;
            var ue;
            var d;
            var R;
            var U;
            var L;
            var y = 0;
            var C = new n.Buf8(4);
            var W = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
            if (!x || !x.state || !x.output || !x.input && x.avail_in !== 0) {
              return f;
            }
            if ((E = x.state).mode === 12) {
              E.mode = 13;
            }
            $ = x.next_out;
            Z = x.output;
            J = x.avail_out;
            N = x.next_in;
            M = x.input;
            O = x.avail_in;
            B = E.hold;
            T = E.bits;
            K = O;
            q = J;
            R = m;
            e: while (true) {
              switch (E.mode) {
                case v:
                  if (E.wrap === 0) {
                    E.mode = 13;
                    break;
                  }
                  while (T < 16) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if (E.wrap & 2 && B === 35615) {
                    C[E.check = 0] = B & 255;
                    C[1] = B >>> 8 & 255;
                    E.check = o(E.check, C, 2, 0);
                    T = B = 0;
                    E.mode = 2;
                    break;
                  }
                  E.flags = 0;
                  if (E.head) {
                    E.head.done = false;
                  }
                  if (!(E.wrap & 1) || (((B & 255) << 8) + (B >> 8)) % 31) {
                    x.msg = "incorrect header check";
                    E.mode = 30;
                    break;
                  }
                  if ((B & 15) != 8) {
                    x.msg = "unknown compression method";
                    E.mode = 30;
                    break;
                  }
                  T -= 4;
                  d = 8 + ((B >>>= 4) & 15);
                  if (E.wbits === 0) {
                    E.wbits = d;
                  } else if (d > E.wbits) {
                    x.msg = "invalid window size";
                    E.mode = 30;
                    break;
                  }
                  E.dmax = 1 << d;
                  x.adler = E.check = 1;
                  E.mode = B & 512 ? 10 : 12;
                  T = B = 0;
                  break;
                case 2:
                  while (T < 16) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  E.flags = B;
                  if ((E.flags & 255) != 8) {
                    x.msg = "unknown compression method";
                    E.mode = 30;
                    break;
                  }
                  if (E.flags & 57344) {
                    x.msg = "unknown header flags set";
                    E.mode = 30;
                    break;
                  }
                  if (E.head) {
                    E.head.text = B >> 8 & 1;
                  }
                  if (E.flags & 512) {
                    C[0] = B & 255;
                    C[1] = B >>> 8 & 255;
                    E.check = o(E.check, C, 2, 0);
                  }
                  T = B = 0;
                  E.mode = 3;
                case 3:
                  while (T < 32) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if (E.head) {
                    E.head.time = B;
                  }
                  if (E.flags & 512) {
                    C[0] = B & 255;
                    C[1] = B >>> 8 & 255;
                    C[2] = B >>> 16 & 255;
                    C[3] = B >>> 24 & 255;
                    E.check = o(E.check, C, 4, 0);
                  }
                  T = B = 0;
                  E.mode = 4;
                case 4:
                  while (T < 16) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if (E.head) {
                    E.head.xflags = B & 255;
                    E.head.os = B >> 8;
                  }
                  if (E.flags & 512) {
                    C[0] = B & 255;
                    C[1] = B >>> 8 & 255;
                    E.check = o(E.check, C, 2, 0);
                  }
                  T = B = 0;
                  E.mode = 5;
                case 5:
                  if (E.flags & 1024) {
                    while (T < 16) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    E.length = B;
                    if (E.head) {
                      E.head.extra_len = B;
                    }
                    if (E.flags & 512) {
                      C[0] = B & 255;
                      C[1] = B >>> 8 & 255;
                      E.check = o(E.check, C, 2, 0);
                    }
                    T = B = 0;
                  } else if (E.head) {
                    E.head.extra = null;
                  }
                  E.mode = 6;
                case 6:
                  if (E.flags & 1024 && (O < (X = E.length) && (X = O), X && (E.head && (d = E.head.extra_len - E.length, E.head.extra ||= new Array(E.head.extra_len), n.arraySet(E.head.extra, M, N, X, d)), E.flags & 512 && (E.check = o(E.check, M, X, N)), O -= X, N += X, E.length -= X), E.length)) {
                    break e;
                  }
                  E.length = 0;
                  E.mode = 7;
                case 7:
                  if (E.flags & 2048) {
                    if (O === 0) {
                      break e;
                    }
                    for (X = 0; d = M[N + X++], E.head && d && E.length < 65536 && (E.head.name += String.fromCharCode(d)), d && X < O;);
                    if (E.flags & 512) {
                      E.check = o(E.check, M, X, N);
                    }
                    O -= X;
                    N += X;
                    if (d) {
                      break e;
                    }
                  } else if (E.head) {
                    E.head.name = null;
                  }
                  E.length = 0;
                  E.mode = 8;
                case 8:
                  if (E.flags & 4096) {
                    if (O === 0) {
                      break e;
                    }
                    for (X = 0; d = M[N + X++], E.head && d && E.length < 65536 && (E.head.comment += String.fromCharCode(d)), d && X < O;);
                    if (E.flags & 512) {
                      E.check = o(E.check, M, X, N);
                    }
                    O -= X;
                    N += X;
                    if (d) {
                      break e;
                    }
                  } else if (E.head) {
                    E.head.comment = null;
                  }
                  E.mode = 9;
                case 9:
                  if (E.flags & 512) {
                    while (T < 16) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    if (B !== (E.check & 65535)) {
                      x.msg = "header crc mismatch";
                      E.mode = 30;
                      break;
                    }
                    T = B = 0;
                  }
                  if (E.head) {
                    E.head.hcrc = E.flags >> 9 & 1;
                    E.head.done = true;
                  }
                  x.adler = E.check = 0;
                  E.mode = 12;
                  break;
                case 10:
                  while (T < 32) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  x.adler = E.check = p(B);
                  T = B = 0;
                  E.mode = 11;
                case 11:
                  if (E.havedict === 0) {
                    x.next_out = $;
                    x.avail_out = J;
                    x.next_in = N;
                    x.avail_in = O;
                    E.hold = B;
                    E.bits = T;
                    return 2;
                  }
                  x.adler = E.check = 1;
                  E.mode = 12;
                case 12:
                  if (I === 5 || I === 6) {
                    break e;
                  }
                case 13:
                  if (E.last) {
                    B >>>= T & 7;
                    T -= T & 7;
                    E.mode = 27;
                    break;
                  }
                  while (T < 3) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  E.last = B & 1;
                  T -= 1;
                  switch ((B >>>= 1) & 3) {
                    case 0:
                      E.mode = 14;
                      break;
                    case 1:
                      H(E);
                      E.mode = 20;
                      if (I !== 6) {
                        break;
                      }
                      B >>>= 2;
                      T -= 2;
                      break e;
                    case 2:
                      E.mode = 17;
                      break;
                    case 3:
                      x.msg = "invalid block type";
                      E.mode = 30;
                  }
                  B >>>= 2;
                  T -= 2;
                  break;
                case 14:
                  B >>>= T & 7;
                  T -= T & 7;
                  while (T < 32) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if ((B & 65535) != (B >>> 16 ^ 65535)) {
                    x.msg = "invalid stored block lengths";
                    E.mode = 30;
                    break;
                  }
                  E.length = B & 65535;
                  T = B = 0;
                  E.mode = 15;
                  if (I === 6) {
                    break e;
                  }
                case 15:
                  E.mode = 16;
                case 16:
                  if (X = E.length) {
                    if (O < X) {
                      X = O;
                    }
                    if (J < X) {
                      X = J;
                    }
                    if (X === 0) {
                      break e;
                    }
                    n.arraySet(Z, M, N, X, $);
                    O -= X;
                    N += X;
                    J -= X;
                    $ += X;
                    E.length -= X;
                    break;
                  }
                  E.mode = 12;
                  break;
                case 17:
                  while (T < 14) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  E.nlen = 257 + (B & 31);
                  B >>>= 5;
                  T -= 5;
                  E.ndist = 1 + (B & 31);
                  B >>>= 5;
                  T -= 5;
                  E.ncode = 4 + (B & 15);
                  B >>>= 4;
                  T -= 4;
                  if (E.nlen > 286 || E.ndist > 30) {
                    x.msg = "too many length or distance symbols";
                    E.mode = 30;
                    break;
                  }
                  E.have = 0;
                  E.mode = 18;
                case 18:
                  while (E.have < E.ncode) {
                    while (T < 3) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    E.lens[W[E.have++]] = B & 7;
                    B >>>= 3;
                    T -= 3;
                  }
                  while (E.have < 19) {
                    E.lens[W[E.have++]] = 0;
                  }
                  E.lencode = E.lendyn;
                  E.lenbits = 7;
                  U = {
                    bits: E.lenbits
                  };
                  R = c(0, E.lens, 0, 19, E.lencode, 0, E.work, U);
                  E.lenbits = U.bits;
                  if (R) {
                    x.msg = "invalid code lengths set";
                    E.mode = 30;
                    break;
                  }
                  E.have = 0;
                  E.mode = 19;
                case 19:
                  while (E.have < E.nlen + E.ndist) {
                    while (ne = (y = E.lencode[B & (1 << E.lenbits) - 1]) >>> 16 & 255, se = y & 65535, !((re = y >>> 24) <= T)) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    if (se < 16) {
                      B >>>= re;
                      T -= re;
                      E.lens[E.have++] = se;
                    } else {
                      if (se === 16) {
                        for (L = re + 2; T < L;) {
                          if (O === 0) {
                            break e;
                          }
                          O--;
                          B += M[N++] << T;
                          T += 8;
                        }
                        B >>>= re;
                        T -= re;
                        if (E.have === 0) {
                          x.msg = "invalid bit length repeat";
                          E.mode = 30;
                          break;
                        }
                        d = E.lens[E.have - 1];
                        X = 3 + (B & 3);
                        B >>>= 2;
                        T -= 2;
                      } else if (se === 17) {
                        for (L = re + 3; T < L;) {
                          if (O === 0) {
                            break e;
                          }
                          O--;
                          B += M[N++] << T;
                          T += 8;
                        }
                        T -= re;
                        d = 0;
                        X = 3 + ((B >>>= re) & 7);
                        B >>>= 3;
                        T -= 3;
                      } else {
                        for (L = re + 7; T < L;) {
                          if (O === 0) {
                            break e;
                          }
                          O--;
                          B += M[N++] << T;
                          T += 8;
                        }
                        T -= re;
                        d = 0;
                        X = 11 + ((B >>>= re) & 127);
                        B >>>= 7;
                        T -= 7;
                      }
                      if (E.have + X > E.nlen + E.ndist) {
                        x.msg = "invalid bit length repeat";
                        E.mode = 30;
                        break;
                      }
                      while (X--) {
                        E.lens[E.have++] = d;
                      }
                    }
                  }
                  if (E.mode === 30) {
                    break;
                  }
                  if (E.lens[256] === 0) {
                    x.msg = "invalid code -- missing end-of-block";
                    E.mode = 30;
                    break;
                  }
                  E.lenbits = 9;
                  U = {
                    bits: E.lenbits
                  };
                  R = c(_, E.lens, 0, E.nlen, E.lencode, 0, E.work, U);
                  E.lenbits = U.bits;
                  if (R) {
                    x.msg = "invalid literal/lengths set";
                    E.mode = 30;
                    break;
                  }
                  E.distbits = 6;
                  E.distcode = E.distdyn;
                  U = {
                    bits: E.distbits
                  };
                  R = c(u, E.lens, E.nlen, E.ndist, E.distcode, 0, E.work, U);
                  E.distbits = U.bits;
                  if (R) {
                    x.msg = "invalid distances set";
                    E.mode = 30;
                    break;
                  }
                  E.mode = 20;
                  if (I === 6) {
                    break e;
                  }
                case 20:
                  E.mode = 21;
                case 21:
                  if (O >= 6 && J >= 258) {
                    x.next_out = $;
                    x.avail_out = J;
                    x.next_in = N;
                    x.avail_in = O;
                    E.hold = B;
                    E.bits = T;
                    l(x, q);
                    $ = x.next_out;
                    Z = x.output;
                    J = x.avail_out;
                    N = x.next_in;
                    M = x.input;
                    O = x.avail_in;
                    B = E.hold;
                    T = E.bits;
                    if (E.mode === 12) {
                      E.back = -1;
                    }
                    break;
                  }
                  for (E.back = 0; ne = (y = E.lencode[B & (1 << E.lenbits) - 1]) >>> 16 & 255, se = y & 65535, !((re = y >>> 24) <= T);) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if (ne && (ne & 240) == 0) {
                    oe = re;
                    fe = ne;
                    ue = se;
                    while (ne = (y = E.lencode[ue + ((B & (1 << oe + fe) - 1) >> oe)]) >>> 16 & 255, se = y & 65535, !(oe + (re = y >>> 24) <= T)) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    B >>>= oe;
                    T -= oe;
                    E.back += oe;
                  }
                  B >>>= re;
                  T -= re;
                  E.back += re;
                  E.length = se;
                  if (ne === 0) {
                    E.mode = 26;
                    break;
                  }
                  if (ne & 32) {
                    E.back = -1;
                    E.mode = 12;
                    break;
                  }
                  if (ne & 64) {
                    x.msg = "invalid literal/length code";
                    E.mode = 30;
                    break;
                  }
                  E.extra = ne & 15;
                  E.mode = 22;
                case 22:
                  if (E.extra) {
                    for (L = E.extra; T < L;) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    E.length += B & (1 << E.extra) - 1;
                    B >>>= E.extra;
                    T -= E.extra;
                    E.back += E.extra;
                  }
                  E.was = E.length;
                  E.mode = 23;
                case 23:
                  while (ne = (y = E.distcode[B & (1 << E.distbits) - 1]) >>> 16 & 255, se = y & 65535, !((re = y >>> 24) <= T)) {
                    if (O === 0) {
                      break e;
                    }
                    O--;
                    B += M[N++] << T;
                    T += 8;
                  }
                  if ((ne & 240) == 0) {
                    oe = re;
                    fe = ne;
                    ue = se;
                    while (ne = (y = E.distcode[ue + ((B & (1 << oe + fe) - 1) >> oe)]) >>> 16 & 255, se = y & 65535, !(oe + (re = y >>> 24) <= T)) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    B >>>= oe;
                    T -= oe;
                    E.back += oe;
                  }
                  B >>>= re;
                  T -= re;
                  E.back += re;
                  if (ne & 64) {
                    x.msg = "invalid distance code";
                    E.mode = 30;
                    break;
                  }
                  E.offset = se;
                  E.extra = ne & 15;
                  E.mode = 24;
                case 24:
                  if (E.extra) {
                    for (L = E.extra; T < L;) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    E.offset += B & (1 << E.extra) - 1;
                    B >>>= E.extra;
                    T -= E.extra;
                    E.back += E.extra;
                  }
                  if (E.offset > E.dmax) {
                    x.msg = "invalid distance too far back";
                    E.mode = 30;
                    break;
                  }
                  E.mode = 25;
                case 25:
                  if (J === 0) {
                    break e;
                  }
                  X = q - J;
                  if (E.offset > X) {
                    if ((X = E.offset - X) > E.whave && E.sane) {
                      x.msg = "invalid distance too far back";
                      E.mode = 30;
                      break;
                    }
                    ae = X > E.wnext ? (X -= E.wnext, E.wsize - X) : E.wnext - X;
                    if (X > E.length) {
                      X = E.length;
                    }
                    ce = E.window;
                  } else {
                    ce = Z;
                    ae = $ - E.offset;
                    X = E.length;
                  }
                  if (J < X) {
                    X = J;
                  }
                  J -= X;
                  E.length -= X;
                  while (Z[$++] = ce[ae++], --X);
                  if (E.length === 0) {
                    E.mode = 21;
                  }
                  break;
                case 26:
                  if (J === 0) {
                    break e;
                  }
                  Z[$++] = E.length;
                  J--;
                  E.mode = 21;
                  break;
                case 27:
                  if (E.wrap) {
                    while (T < 32) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B |= M[N++] << T;
                      T += 8;
                    }
                    q -= J;
                    x.total_out += q;
                    E.total += q;
                    if (q) {
                      x.adler = E.check = E.flags ? o(E.check, Z, q, $ - q) : a(E.check, Z, q, $ - q);
                    }
                    q = J;
                    if ((E.flags ? B : p(B)) !== E.check) {
                      x.msg = "incorrect data check";
                      E.mode = 30;
                      break;
                    }
                    T = B = 0;
                  }
                  E.mode = 28;
                case 28:
                  if (E.wrap && E.flags) {
                    while (T < 32) {
                      if (O === 0) {
                        break e;
                      }
                      O--;
                      B += M[N++] << T;
                      T += 8;
                    }
                    if (B !== (E.total & -1)) {
                      x.msg = "incorrect length check";
                      E.mode = 30;
                      break;
                    }
                    T = B = 0;
                  }
                  E.mode = 29;
                case 29:
                  R = 1;
                  break e;
                case 30:
                  R = -3;
                  break e;
                case 31:
                  return -4;
                default:
                  return f;
              }
            }
            x.next_out = $;
            x.avail_out = J;
            x.next_in = N;
            x.avail_in = O;
            E.hold = B;
            E.bits = T;
            if ((E.wsize || q !== x.avail_out && E.mode < 30 && (E.mode < 27 || I !== 4)) && z(x, x.output, x.next_out, q - x.avail_out)) {
              E.mode = 31;
              return -4;
            } else {
              K -= x.avail_in;
              q -= x.avail_out;
              x.total_in += K;
              x.total_out += q;
              E.total += q;
              if (E.wrap && q) {
                x.adler = E.check = E.flags ? o(E.check, Z, q, x.next_out - q) : a(E.check, Z, q, x.next_out - q);
              }
              x.data_type = E.bits + (E.last ? 64 : 0) + (E.mode === 12 ? 128 : 0) + (E.mode === 20 || E.mode === 15 ? 256 : 0);
              if ((K == 0 && q === 0 || I === 4) && R === m) {
                R = -5;
              }
              return R;
            }
          };
          t.inflateEnd = function (x) {
            if (!x || !x.state) {
              return f;
            }
            var I = x.state;
            I.window &&= null;
            x.state = null;
            return m;
          };
          t.inflateGetHeader = function (x, I) {
            var E;
            if (x && x.state) {
              if (((E = x.state).wrap & 2) == 0) {
                return f;
              } else {
                (E.head = I).done = false;
                return m;
              }
            } else {
              return f;
            }
          };
          t.inflateSetDictionary = function (x, I) {
            var E;
            var M = I.length;
            if (x && x.state) {
              if ((E = x.state).wrap !== 0 && E.mode !== 11) {
                return f;
              } else if (E.mode === 11 && a(1, I, M, 0) !== E.check) {
                return -3;
              } else if (z(x, I, M, M)) {
                E.mode = 31;
                return -4;
              } else {
                E.havedict = 1;
                return m;
              }
            } else {
              return f;
            }
          };
          t.inflateInfo = "pako inflate (from Nodeca project)";
        }, {
          "../utils/common": 41,
          "./adler32": 43,
          "./crc32": 45,
          "./inffast": 48,
          "./inftrees": 50
        }],
        50: [function (e, r, t) {
          "use strict";

          var n = e("../utils/common");
          var a = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0];
          var o = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78];
          var l = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0];
          var c = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
          r.exports = function (_, u, m, f, v, g, h, p) {
            var b;
            var S;
            var w;
            var A;
            var k;
            var G;
            var D;
            var F;
            var H;
            var z = p.bits;
            var x = 0;
            var I = 0;
            var E = 0;
            var M = 0;
            var Z = 0;
            var N = 0;
            var $ = 0;
            var O = 0;
            var J = 0;
            var B = 0;
            var T = null;
            var K = 0;
            var q = new n.Buf16(16);
            var X = new n.Buf16(16);
            var ae = null;
            var ce = 0;
            for (x = 0; x <= 15; x++) {
              q[x] = 0;
            }
            for (I = 0; I < f; I++) {
              q[u[m + I]]++;
            }
            Z = z;
            M = 15;
            for (; M >= 1 && q[M] === 0; M--);
            if (M < Z) {
              Z = M;
            }
            if (M === 0) {
              v[g++] = 20971520;
              v[g++] = 20971520;
              p.bits = 1;
              return 0;
            }
            for (E = 1; E < M && q[E] === 0; E++);
            if (Z < E) {
              Z = E;
            }
            x = O = 1;
            for (; x <= 15; x++) {
              O <<= 1;
              if ((O -= q[x]) < 0) {
                return -1;
              }
            }
            if (O > 0 && (_ === 0 || M !== 1)) {
              return -1;
            }
            X[1] = 0;
            x = 1;
            for (; x < 15; x++) {
              X[x + 1] = X[x] + q[x];
            }
            for (I = 0; I < f; I++) {
              if (u[m + I] !== 0) {
                h[X[u[m + I]]++] = I;
              }
            }
            G = _ === 0 ? (T = ae = h, 19) : _ === 1 ? (T = a, K -= 257, ae = o, ce -= 257, 256) : (T = l, ae = c, -1);
            x = E;
            k = g;
            $ = I = B = 0;
            w = -1;
            A = (J = 1 << (N = Z)) - 1;
            if (_ === 1 && J > 852 || _ === 2 && J > 592) {
              return 1;
            }
            while (true) {
              D = x - $;
              H = h[I] < G ? (F = 0, h[I]) : h[I] > G ? (F = ae[ce + h[I]], T[K + h[I]]) : (F = 96, 0);
              b = 1 << x - $;
              E = S = 1 << N;
              while (v[k + (B >> $) + (S -= b)] = D << 24 | F << 16 | H | 0, S !== 0);
              for (b = 1 << x - 1; B & b;) {
                b >>= 1;
              }
              if (b !== 0) {
                B &= b - 1;
                B += b;
              } else {
                B = 0;
              }
              I++;
              if (--q[x] == 0) {
                if (x === M) {
                  break;
                }
                x = u[m + h[I]];
              }
              if (Z < x && (B & A) !== w) {
                if ($ === 0) {
                  $ = Z;
                }
                k += E;
                O = 1 << (N = x - $);
                while (N + $ < M && !((O -= q[N + $]) <= 0)) {
                  N++;
                  O <<= 1;
                }
                J += 1 << N;
                if (_ === 1 && J > 852 || _ === 2 && J > 592) {
                  return 1;
                }
                v[w = B & A] = Z << 24 | N << 16 | k - g | 0;
              }
            }
            if (B !== 0) {
              v[k + B] = x - $ << 24 | 4194304 | 0;
            }
            p.bits = Z;
            return 0;
          };
        }, {
          "../utils/common": 41
        }],
        51: [function (e, r, t) {
          "use strict";

          r.exports = {
            2: "need dictionary",
            1: "stream end",
            0: "",
            "-1": "file error",
            "-2": "stream error",
            "-3": "data error",
            "-4": "insufficient memory",
            "-5": "buffer error",
            "-6": "incompatible version"
          };
        }, {}],
        52: [function (e, r, t) {
          "use strict";

          var n = e("../utils/common");
          var a = 0;
          var o = 1;
          function l(y) {
            for (var C = y.length; --C >= 0;) {
              y[C] = 0;
            }
          }
          var c = 0;
          var _ = 29;
          var u = 256;
          var m = u + 1 + _;
          var f = 30;
          var v = 19;
          var g = m * 2 + 1;
          var h = 15;
          var p = 16;
          var b = 7;
          var S = 256;
          var w = 16;
          var A = 17;
          var k = 18;
          var G = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
          var D = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
          var F = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];
          var H = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          var z = new Array((m + 2) * 2);
          l(z);
          var x = new Array(f * 2);
          l(x);
          var I = new Array(512);
          l(I);
          var E = new Array(256);
          l(E);
          var M = new Array(_);
          l(M);
          var Z;
          var N;
          var $;
          var O = new Array(f);
          function J(y, C, W, V, P) {
            this.static_tree = y;
            this.extra_bits = C;
            this.extra_base = W;
            this.elems = V;
            this.max_length = P;
            this.has_stree = y && y.length;
          }
          function B(y, C) {
            this.dyn_tree = y;
            this.max_code = 0;
            this.stat_desc = C;
          }
          function T(y) {
            if (y < 256) {
              return I[y];
            } else {
              return I[256 + (y >>> 7)];
            }
          }
          function K(y, C) {
            y.pending_buf[y.pending++] = C & 255;
            y.pending_buf[y.pending++] = C >>> 8 & 255;
          }
          function q(y, C, W) {
            if (y.bi_valid > p - W) {
              y.bi_buf |= C << y.bi_valid & 65535;
              K(y, y.bi_buf);
              y.bi_buf = C >> p - y.bi_valid;
              y.bi_valid += W - p;
            } else {
              y.bi_buf |= C << y.bi_valid & 65535;
              y.bi_valid += W;
            }
          }
          function X(y, C, W) {
            q(y, W[C * 2], W[C * 2 + 1]);
          }
          function ae(y, C) {
            for (var W = 0; W |= y & 1, y >>>= 1, W <<= 1, --C > 0;);
            return W >>> 1;
          }
          function ce(y, C, W) {
            var V;
            var P;
            var j = new Array(h + 1);
            var Y = 0;
            for (V = 1; V <= h; V++) {
              j[V] = Y = Y + W[V - 1] << 1;
            }
            for (P = 0; P <= C; P++) {
              var Q = y[P * 2 + 1];
              if (Q !== 0) {
                y[P * 2] = ae(j[Q]++, Q);
              }
            }
          }
          function re(y) {
            var C;
            for (C = 0; C < m; C++) {
              y.dyn_ltree[C * 2] = 0;
            }
            for (C = 0; C < f; C++) {
              y.dyn_dtree[C * 2] = 0;
            }
            for (C = 0; C < v; C++) {
              y.bl_tree[C * 2] = 0;
            }
            y.dyn_ltree[S * 2] = 1;
            y.opt_len = y.static_len = 0;
            y.last_lit = y.matches = 0;
          }
          function ne(y) {
            if (y.bi_valid > 8) {
              K(y, y.bi_buf);
            } else if (y.bi_valid > 0) {
              y.pending_buf[y.pending++] = y.bi_buf;
            }
            y.bi_buf = 0;
            y.bi_valid = 0;
          }
          function se(y, C, W, V) {
            var P = C * 2;
            var j = W * 2;
            return y[P] < y[j] || y[P] === y[j] && V[C] <= V[W];
          }
          function oe(y, C, W) {
            for (var V = y.heap[W], P = W << 1; P <= y.heap_len && (P < y.heap_len && se(C, y.heap[P + 1], y.heap[P], y.depth) && P++, !se(C, V, y.heap[P], y.depth));) {
              y.heap[W] = y.heap[P];
              W = P;
              P <<= 1;
            }
            y.heap[W] = V;
          }
          function fe(y, C, W) {
            var V;
            var P;
            var j;
            var Y;
            var Q = 0;
            if (y.last_lit !== 0) {
              while (V = y.pending_buf[y.d_buf + Q * 2] << 8 | y.pending_buf[y.d_buf + Q * 2 + 1], P = y.pending_buf[y.l_buf + Q], Q++, V === 0 ? X(y, P, C) : (X(y, (j = E[P]) + u + 1, C), (Y = G[j]) !== 0 && q(y, P -= M[j], Y), X(y, j = T(--V), W), (Y = D[j]) !== 0 && q(y, V -= O[j], Y)), Q < y.last_lit);
            }
            X(y, S, C);
          }
          function ue(y, C) {
            var W;
            var V;
            var P;
            var j = C.dyn_tree;
            var Y = C.stat_desc.static_tree;
            var Q = C.stat_desc.has_stree;
            var ee = C.stat_desc.elems;
            var ie = -1;
            y.heap_len = 0;
            y.heap_max = g;
            W = 0;
            for (; W < ee; W++) {
              if (j[W * 2] !== 0) {
                y.heap[++y.heap_len] = ie = W;
                y.depth[W] = 0;
              } else {
                j[W * 2 + 1] = 0;
              }
            }
            while (y.heap_len < 2) {
              j[(P = y.heap[++y.heap_len] = ie < 2 ? ++ie : 0) * 2] = 1;
              y.depth[P] = 0;
              y.opt_len--;
              if (Q) {
                y.static_len -= Y[P * 2 + 1];
              }
            }
            C.max_code = ie;
            W = y.heap_len >> 1;
            for (; W >= 1; W--) {
              oe(y, j, W);
            }
            for (P = ee; W = y.heap[1], y.heap[1] = y.heap[y.heap_len--], oe(y, j, 1), V = y.heap[1], y.heap[--y.heap_max] = W, y.heap[--y.heap_max] = V, j[P * 2] = j[W * 2] + j[V * 2], y.depth[P] = (y.depth[W] >= y.depth[V] ? y.depth[W] : y.depth[V]) + 1, j[W * 2 + 1] = j[V * 2 + 1] = P, y.heap[1] = P++, oe(y, j, 1), y.heap_len >= 2;);
            y.heap[--y.heap_max] = y.heap[1];
            (function (te, _e) {
              var he;
              var ge;
              var Ee;
              var le;
              var ke;
              var Be;
              var de = _e.dyn_tree;
              var Je = _e.max_code;
              var Fr = _e.stat_desc.static_tree;
              var kr = _e.stat_desc.has_stree;
              var Cr = _e.stat_desc.extra_bits;
              var Ke = _e.stat_desc.extra_base;
              var be = _e.stat_desc.max_length;
              var Ce = 0;
              for (le = 0; le <= h; le++) {
                te.bl_count[le] = 0;
              }
              de[te.heap[te.heap_max] * 2 + 1] = 0;
              he = te.heap_max + 1;
              for (; he < g; he++) {
                if (be < (le = de[de[(ge = te.heap[he]) * 2 + 1] * 2 + 1] + 1)) {
                  le = be;
                  Ce++;
                }
                de[ge * 2 + 1] = le;
                if (!(Je < ge)) {
                  te.bl_count[le]++;
                  ke = 0;
                  if (Ke <= ge) {
                    ke = Cr[ge - Ke];
                  }
                  Be = de[ge * 2];
                  te.opt_len += Be * (le + ke);
                  if (kr) {
                    te.static_len += Be * (Fr[ge * 2 + 1] + ke);
                  }
                }
              }
              if (Ce !== 0) {
                do {
                  for (le = be - 1; te.bl_count[le] === 0;) {
                    le--;
                  }
                  te.bl_count[le]--;
                  te.bl_count[le + 1] += 2;
                  te.bl_count[be]--;
                  Ce -= 2;
                } while (Ce > 0);
                for (le = be; le !== 0; le--) {
                  for (ge = te.bl_count[le]; ge !== 0;) {
                    if (!(Je < (Ee = te.heap[--he]))) {
                      if (de[Ee * 2 + 1] !== le) {
                        te.opt_len += (le - de[Ee * 2 + 1]) * de[Ee * 2];
                        de[Ee * 2 + 1] = le;
                      }
                      ge--;
                    }
                  }
                }
              }
            })(y, C);
            ce(j, ie, y.bl_count);
          }
          function d(y, C, W) {
            var V;
            var P;
            var j = -1;
            var Y = C[1];
            var Q = 0;
            var ee = 7;
            var ie = 4;
            if (Y === 0) {
              ee = 138;
              ie = 3;
            }
            C[(W + 1) * 2 + 1] = 65535;
            V = 0;
            for (; V <= W; V++) {
              P = Y;
              Y = C[(V + 1) * 2 + 1];
              if (!(++Q < ee) || P !== Y) {
                if (Q < ie) {
                  y.bl_tree[P * 2] += Q;
                } else if (P !== 0) {
                  if (P !== j) {
                    y.bl_tree[P * 2]++;
                  }
                  y.bl_tree[w * 2]++;
                } else if (Q <= 10) {
                  y.bl_tree[A * 2]++;
                } else {
                  y.bl_tree[k * 2]++;
                }
                j = P;
                ie = (Q = 0) === Y ? (ee = 138, 3) : P === Y ? (ee = 6, 3) : (ee = 7, 4);
              }
            }
          }
          function R(y, C, W) {
            var V;
            var P;
            var j = -1;
            var Y = C[1];
            var Q = 0;
            var ee = 7;
            var ie = 4;
            if (Y === 0) {
              ee = 138;
              ie = 3;
            }
            V = 0;
            for (; V <= W; V++) {
              P = Y;
              Y = C[(V + 1) * 2 + 1];
              if (!(++Q < ee) || P !== Y) {
                if (Q < ie) {
                  while (X(y, P, y.bl_tree), --Q != 0);
                } else if (P !== 0) {
                  if (P !== j) {
                    X(y, P, y.bl_tree);
                    Q--;
                  }
                  X(y, w, y.bl_tree);
                  q(y, Q - 3, 2);
                } else if (Q <= 10) {
                  X(y, A, y.bl_tree);
                  q(y, Q - 3, 3);
                } else {
                  X(y, k, y.bl_tree);
                  q(y, Q - 11, 7);
                }
                j = P;
                ie = (Q = 0) === Y ? (ee = 138, 3) : P === Y ? (ee = 6, 3) : (ee = 7, 4);
              }
            }
          }
          l(O);
          var U = false;
          function L(y, C, W, V) {
            q(y, (c << 1) + (V ? 1 : 0), 3);
            (function (P, j, Y, Q) {
              ne(P);
              if (Q) {
                K(P, Y);
                K(P, ~Y);
              }
              n.arraySet(P.pending_buf, P.window, j, Y, P.pending);
              P.pending += Y;
            })(y, C, W, true);
          }
          t._tr_init = function (y) {
            if (!U) {
              (function () {
                var C;
                var W;
                var V;
                var P;
                var j;
                var Y = new Array(h + 1);
                for (P = V = 0; P < _ - 1; P++) {
                  M[P] = V;
                  C = 0;
                  for (; C < 1 << G[P]; C++) {
                    E[V++] = P;
                  }
                }
                E[V - 1] = P;
                P = j = 0;
                for (; P < 16; P++) {
                  O[P] = j;
                  C = 0;
                  for (; C < 1 << D[P]; C++) {
                    I[j++] = P;
                  }
                }
                for (j >>= 7; P < f; P++) {
                  O[P] = j << 7;
                  C = 0;
                  for (; C < 1 << D[P] - 7; C++) {
                    I[256 + j++] = P;
                  }
                }
                for (W = 0; W <= h; W++) {
                  Y[W] = 0;
                }
                for (C = 0; C <= 143;) {
                  z[C * 2 + 1] = 8;
                  C++;
                  Y[8]++;
                }
                while (C <= 255) {
                  z[C * 2 + 1] = 9;
                  C++;
                  Y[9]++;
                }
                while (C <= 279) {
                  z[C * 2 + 1] = 7;
                  C++;
                  Y[7]++;
                }
                while (C <= 287) {
                  z[C * 2 + 1] = 8;
                  C++;
                  Y[8]++;
                }
                ce(z, m + 1, Y);
                C = 0;
                for (; C < f; C++) {
                  x[C * 2 + 1] = 5;
                  x[C * 2] = ae(C, 5);
                }
                Z = new J(z, G, u + 1, m, h);
                N = new J(x, D, 0, f, h);
                $ = new J(new Array(0), F, 0, v, b);
              })();
              U = true;
            }
            y.l_desc = new B(y.dyn_ltree, Z);
            y.d_desc = new B(y.dyn_dtree, N);
            y.bl_desc = new B(y.bl_tree, $);
            y.bi_buf = 0;
            y.bi_valid = 0;
            re(y);
          };
          t._tr_stored_block = L;
          t._tr_flush_block = function (y, C, W, V) {
            var P;
            var j;
            var Y = 0;
            if (y.level > 0) {
              if (y.strm.data_type === 2) {
                y.strm.data_type = function (Q) {
                  var ee;
                  var ie = 4093624447;
                  for (ee = 0; ee <= 31; ee++, ie >>>= 1) {
                    if (ie & 1 && Q.dyn_ltree[ee * 2] !== 0) {
                      return a;
                    }
                  }
                  if (Q.dyn_ltree[18] !== 0 || Q.dyn_ltree[20] !== 0 || Q.dyn_ltree[26] !== 0) {
                    return o;
                  }
                  for (ee = 32; ee < u; ee++) {
                    if (Q.dyn_ltree[ee * 2] !== 0) {
                      return o;
                    }
                  }
                  return a;
                }(y);
              }
              ue(y, y.l_desc);
              ue(y, y.d_desc);
              Y = function (Q) {
                var ee;
                d(Q, Q.dyn_ltree, Q.l_desc.max_code);
                d(Q, Q.dyn_dtree, Q.d_desc.max_code);
                ue(Q, Q.bl_desc);
                ee = v - 1;
                for (; ee >= 3 && Q.bl_tree[H[ee] * 2 + 1] === 0; ee--);
                Q.opt_len += (ee + 1) * 3 + 5 + 5 + 4;
                return ee;
              }(y);
              P = y.opt_len + 3 + 7 >>> 3;
              if ((j = y.static_len + 3 + 7 >>> 3) <= P) {
                P = j;
              }
            } else {
              P = j = W + 5;
            }
            if (W + 4 <= P && C !== -1) {
              L(y, C, W, V);
            } else if (y.strategy === 4 || j === P) {
              q(y, 2 + (V ? 1 : 0), 3);
              fe(y, z, x);
            } else {
              q(y, 4 + (V ? 1 : 0), 3);
              (function (Q, ee, ie, te) {
                var _e;
                q(Q, ee - 257, 5);
                q(Q, ie - 1, 5);
                q(Q, te - 4, 4);
                _e = 0;
                for (; _e < te; _e++) {
                  q(Q, Q.bl_tree[H[_e] * 2 + 1], 3);
                }
                R(Q, Q.dyn_ltree, ee - 1);
                R(Q, Q.dyn_dtree, ie - 1);
              })(y, y.l_desc.max_code + 1, y.d_desc.max_code + 1, Y + 1);
              fe(y, y.dyn_ltree, y.dyn_dtree);
            }
            re(y);
            if (V) {
              ne(y);
            }
          };
          t._tr_tally = function (y, C, W) {
            y.pending_buf[y.d_buf + y.last_lit * 2] = C >>> 8 & 255;
            y.pending_buf[y.d_buf + y.last_lit * 2 + 1] = C & 255;
            y.pending_buf[y.l_buf + y.last_lit] = W & 255;
            y.last_lit++;
            if (C === 0) {
              y.dyn_ltree[W * 2]++;
            } else {
              y.matches++;
              C--;
              y.dyn_ltree[(E[W] + u + 1) * 2]++;
              y.dyn_dtree[T(C) * 2]++;
            }
            return y.last_lit === y.lit_bufsize - 1;
          };
          t._tr_align = function (y) {
            q(y, 2, 3);
            X(y, S, z);
            (function (C) {
              if (C.bi_valid === 16) {
                K(C, C.bi_buf);
                C.bi_buf = 0;
                C.bi_valid = 0;
              } else if (C.bi_valid >= 8) {
                C.pending_buf[C.pending++] = C.bi_buf & 255;
                C.bi_buf >>= 8;
                C.bi_valid -= 8;
              }
            })(y);
          };
        }, {
          "../utils/common": 41
        }],
        53: [function (e, r, t) {
          "use strict";

          r.exports = function () {
            this.input = null;
            this.next_in = 0;
            this.avail_in = 0;
            this.total_in = 0;
            this.output = null;
            this.next_out = 0;
            this.avail_out = 0;
            this.total_out = 0;
            this.msg = "";
            this.state = null;
            this.data_type = 2;
            this.adler = 0;
          };
        }, {}],
        54: [function (e, r, t) {
          (function (n) {
            (function (a, o) {
              "use strict";

              if (!a.setImmediate) {
                var l;
                var c;
                var _;
                var u;
                var m = 1;
                var f = {};
                var v = false;
                var g = a.document;
                var h = Object.getPrototypeOf && Object.getPrototypeOf(a);
                h = h && h.setTimeout ? h : a;
                l = {}.toString.call(a.process) === "[object process]" ? function (w) {
                  process.nextTick(function () {
                    b(w);
                  });
                } : function () {
                  if (a.postMessage && !a.importScripts) {
                    var w = true;
                    var A = a.onmessage;
                    a.onmessage = function () {
                      w = false;
                    };
                    a.postMessage("", "*");
                    a.onmessage = A;
                    return w;
                  }
                }() ? (u = "setImmediate$" + Math.random() + "$", a.addEventListener ? a.addEventListener("message", S, false) : a.attachEvent("onmessage", S), function (w) {
                  a.postMessage(u + w, "*");
                }) : a.MessageChannel ? ((_ = new MessageChannel()).port1.onmessage = function (w) {
                  b(w.data);
                }, function (w) {
                  _.port2.postMessage(w);
                }) : g && "onreadystatechange" in g.createElement("script") ? (c = g.documentElement, function (w) {
                  var A = g.createElement("script");
                  A.onreadystatechange = function () {
                    b(w);
                    A.onreadystatechange = null;
                    c.removeChild(A);
                    A = null;
                  };
                  c.appendChild(A);
                }) : function (w) {
                  setTimeout(b, 0, w);
                };
                h.setImmediate = function (w) {
                  if (typeof w != "function") {
                    w = new Function("" + w);
                  }
                  for (var A = new Array(arguments.length - 1), k = 0; k < A.length; k++) {
                    A[k] = arguments[k + 1];
                  }
                  var G = {
                    callback: w,
                    args: A
                  };
                  f[m] = G;
                  l(m);
                  return m++;
                };
                h.clearImmediate = p;
              }
              function p(w) {
                delete f[w];
              }
              function b(w) {
                if (v) {
                  setTimeout(b, 0, w);
                } else {
                  var A = f[w];
                  if (A) {
                    v = true;
                    try {
                      (function (k) {
                        var G = k.callback;
                        var D = k.args;
                        switch (D.length) {
                          case 0:
                            G();
                            break;
                          case 1:
                            G(D[0]);
                            break;
                          case 2:
                            G(D[0], D[1]);
                            break;
                          case 3:
                            G(D[0], D[1], D[2]);
                            break;
                          default:
                            G.apply(o, D);
                        }
                      })(A);
                    } finally {
                      p(w);
                      v = false;
                    }
                  }
                }
              }
              function S(w) {
                if (w.source === a && typeof w.data == "string" && w.data.indexOf(u) === 0) {
                  b(+w.data.slice(u.length));
                }
              }
            })(typeof self === "undefined" ? n === undefined ? this : n : self);
          }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
        }, {}]
      }, {}, [10])(10);
    });
  });
  var tr;
  var Ue;
  var Me;
  var nr;
  var He;
  var Re;
  var Oe;
  var Ne;
  var We = pe(() => {
    tr = "xash.wasm";
    Ue = "filesystem_stdio.wasm";
    Me = "libref_webgl2.wasm";
    nr = "libref_webgl2.wasm";
    He = "libref_soft.wasm";
    Re = "cl_dlls/menu_emscripten_wasm32.wasm";
    Oe = "cl_dlls/client_emscripten_wasm32.wasm";
    Ne = "dlls/hl_emscripten_wasm32.wasm";
  });
  var Mr;
  var ir;
  var ar = pe(() => {
    Mr = (() => {
      var _scriptName = globalThis.document?.currentScript?.src;
      return async function (moduleArg = {}) {
        var moduleRtn;
        var Module = moduleArg;
        var ENVIRONMENT_IS_WEB = true;
        var ENVIRONMENT_IS_WORKER = false;
        var ENVIRONMENT_IS_NODE = false;
        var ENVIRONMENT_IS_SHELL = false;
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = (e, r) => {
          throw r;
        };
        var scriptDirectory = "";
        function locateFile(e) {
          if (Module.locateFile) {
            return Module.locateFile(e, scriptDirectory);
          } else {
            return scriptDirectory + e;
          }
        }
        var readAsync;
        var readBinary;
        if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          try {
            scriptDirectory = new URL(".", _scriptName).href;
          } catch {}
          readAsync = async e => {
            var r = await fetch(e, {
              credentials: "same-origin"
            });
            if (r.ok) {
              return r.arrayBuffer();
            }
            throw new Error(r.status + " : " + r.url);
          };
        }
        var out = console.log.bind(console);
        var err = console.error.bind(console);
        var dynamicLibraries = [];
        var wasmBinary;
        var ABORT = false;
        var EXITSTATUS;
        function assert(e, r) {
          if (!e) {
            abort(r);
          }
        }
        var isFileURI = e => e.startsWith("file://");
        var readyPromiseResolve;
        var readyPromiseReject;
        var HEAP8;
        var HEAPU8;
        var HEAP16;
        var HEAPU16;
        var HEAP32;
        var HEAPU32;
        var HEAPF32;
        var HEAPF64;
        var HEAP64;
        var HEAPU64;
        var runtimeInitialized = false;
        function updateMemoryViews() {
          var e = wasmMemory.buffer;
          HEAP8 = new Int8Array(e);
          HEAP16 = new Int16Array(e);
          HEAPU8 = new Uint8Array(e);
          HEAPU16 = new Uint16Array(e);
          HEAP32 = new Int32Array(e);
          HEAPU32 = new Uint32Array(e);
          HEAPF32 = new Float32Array(e);
          HEAPF64 = new Float64Array(e);
          HEAP64 = new BigInt64Array(e);
          HEAPU64 = new BigUint64Array(e);
        }
        var __RELOC_FUNCS__ = [];
        function preRun() {
          if (Module.preRun) {
            for (typeof Module.preRun == "function" && (Module.preRun = [Module.preRun]); Module.preRun.length;) {
              addOnPreRun(Module.preRun.shift());
            }
          }
          callRuntimeCallbacks(onPreRuns);
        }
        function initRuntime() {
          runtimeInitialized = true;
          callRuntimeCallbacks(__RELOC_FUNCS__);
          callRuntimeCallbacks(onInits);
          if (!Module.noFSInit && !FS.initialized) {
            FS.init();
          }
          TTY.init();
          SOCKFS.root = FS.mount(SOCKFS, {}, null);
          PIPEFS.root = FS.mount(PIPEFS, {}, null);
          wasmExports.__wasm_call_ctors();
          callRuntimeCallbacks(onPostCtors);
          FS.ignorePermissions = false;
        }
        function preMain() {
          callRuntimeCallbacks(onMains);
        }
        function postRun() {
          if (Module.postRun) {
            for (typeof Module.postRun == "function" && (Module.postRun = [Module.postRun]); Module.postRun.length;) {
              addOnPostRun(Module.postRun.shift());
            }
          }
          callRuntimeCallbacks(onPostRuns);
        }
        function abort(e) {
          Module.onAbort?.(e);
          e = "Aborted(" + e + ")";
          err(e);
          ABORT = true;
          e += ". Build with -sASSERTIONS for more info.";
          var r = new WebAssembly.RuntimeError(e);
          readyPromiseReject?.(r);
          throw r;
        }
        var wasmBinaryFile;
        function findWasmBinary() {
          return locateFile("xash.wasm");
        }
        function getBinarySync(e) {
          if (e == wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
          }
          if (readBinary) {
            return readBinary(e);
          }
          throw "both async and sync fetching of the wasm failed";
        }
        async function getWasmBinary(e) {
          if (!wasmBinary) {
            try {
              var r = await readAsync(e);
              return new Uint8Array(r);
            } catch {}
          }
          return getBinarySync(e);
        }
        async function instantiateArrayBuffer(e, r) {
          try {
            var t = await getWasmBinary(e);
            var n = await WebAssembly.instantiate(t, r);
            return n;
          } catch (a) {
            err(`failed to asynchronously prepare wasm: ${a}`);
            abort(a);
          }
        }
        async function instantiateAsync(e, r, t) {
          if (!e) {
            try {
              var n = fetch(r, {
                credentials: "same-origin"
              });
              var a = await WebAssembly.instantiateStreaming(n, t);
              return a;
            } catch (o) {
              err(`wasm streaming compile failed: ${o}`);
              err("falling back to ArrayBuffer instantiation");
            }
          }
          return instantiateArrayBuffer(r, t);
        }
        function getWasmImports() {
          var e = new Proxy(new Set(["__start___llvm_prf_data", "__stop___llvm_prf_data", "__start___llvm_prf_names", "__stop___llvm_prf_names", "__start___llvm_prf_vns", "__stop___llvm_prf_vns", "__start___llvm_prf_vtab", "__stop___llvm_prf_vtab", "__start___llvm_prf_cnts", "__stop___llvm_prf_cnts", "__start___llvm_prf_bits", "__stop___llvm_prf_bits", "__start___llvm_prf_vnds", "__stop___llvm_prf_vnds"]), GOTHandler);
          var r = {
            env: wasmImports,
            wasi_snapshot_preview1: wasmImports,
            "GOT.mem": e,
            "GOT.func": e
          };
          return r;
        }
        async function createWasm() {
          function e(o, l) {
            wasmExports = o.exports;
            var c = wasmExports;
            mergeLibSymbols(wasmExports, "main");
            var _ = getDylinkMetadata(l);
            if (_.neededDynlibs) {
              dynamicLibraries = _.neededDynlibs.concat(dynamicLibraries);
            }
            assignWasmExports(wasmExports);
            updateGOT(c);
            LDSO.init();
            loadDylibs();
            updateMemoryViews();
            return wasmExports;
          }
          function r(o) {
            return e(o.instance, o.module);
          }
          var t = getWasmImports();
          if (Module.instantiateWasm) {
            return new Promise((o, l) => {
              Module.instantiateWasm(t, (c, _) => {
                o(e(c, _));
              });
            });
          }
          wasmBinaryFile ??= findWasmBinary();
          var n = await instantiateAsync(wasmBinary, wasmBinaryFile, t);
          var a = r(n);
          return a;
        }
        class ExitStatus {
          constructor(r) {
            this.name = "ExitStatus";
            this.message = `Program terminated with exit(${r})`;
            this.status = r;
          }
        }
        var GOT = {};
        var GOTHandler = {
          get(e, r) {
            var t = GOT[r];
            t ||= GOT[r] = new WebAssembly.Global({
              value: "i32",
              mutable: true
            }, -1);
            if (!e.has(r)) {
              t.required = true;
            }
            return t;
          }
        };
        var callRuntimeCallbacks = e => {
          while (e.length > 0) {
            e.shift()(Module);
          }
        };
        var onPostRuns = [];
        var addOnPostRun = e => onPostRuns.push(e);
        var onPreRuns = [];
        var addOnPreRun = e => onPreRuns.push(e);
        var UTF8Decoder = new TextDecoder();
        var findStringEnd = (e, r, t, n) => {
          var a = r + t;
          if (n) {
            return a;
          }
          while (e[r] && !(r >= a)) {
            ++r;
          }
          return r;
        };
        var UTF8ArrayToString = (e, r = 0, t, n) => {
          var a = findStringEnd(e, r, t, n);
          return UTF8Decoder.decode(e.buffer ? e.subarray(r, a) : new Uint8Array(e.slice(r, a)));
        };
        var getDylinkMetadata = e => {
          var r = 0;
          var t = 0;
          function n() {
            return e[r++];
          }
          function a() {
            var E = 0;
            var M = 1;
            while (true) {
              var Z = e[r++];
              E += (Z & 127) * M;
              M *= 128;
              if (!(Z & 128)) {
                break;
              }
            }
            return E;
          }
          function o() {
            var E = a();
            r += E;
            return UTF8ArrayToString(e, r - E, E);
          }
          function l() {
            for (var E = a(), M = []; E--;) {
              M.push(o());
            }
            return M;
          }
          function c(E, M) {
            if (E) {
              throw new Error(M);
            }
          }
          if (e instanceof WebAssembly.Module) {
            var _ = WebAssembly.Module.customSections(e, "dylink.0");
            c(_.length === 0, "need dylink section");
            e = new Uint8Array(_[0]);
            t = e.length;
          } else {
            var u = new Uint32Array(new Uint8Array(e.subarray(0, 24)).buffer);
            var m = u[0] == 1836278016;
            c(!m, "need to see wasm magic number");
            c(e[8] !== 0, "need the dylink section to be first");
            r = 9;
            var f = a();
            t = r + f;
            var v = o();
            c(v !== "dylink.0");
          }
          var g = {
            neededDynlibs: [],
            tlsExports: new Set(),
            weakImports: new Set(),
            runtimePaths: []
          };
          var h = 1;
          var p = 2;
          var b = 3;
          var S = 4;
          var w = 5;
          var A = 256;
          var k = 3;
          var G = 1;
          for (; r < t;) {
            var D = n();
            var F = a();
            if (D === h) {
              g.memorySize = a();
              g.memoryAlign = a();
              g.tableSize = a();
              g.tableAlign = a();
            } else if (D === p) {
              g.neededDynlibs = l();
            } else if (D === b) {
              for (var H = a(); H--;) {
                var z = o();
                var x = a();
                if (x & A) {
                  g.tlsExports.add(z);
                }
              }
            } else if (D === S) {
              for (var H = a(); H--;) {
                var I = o();
                var z = o();
                var x = a();
                if ((x & k) == G) {
                  g.weakImports.add(z);
                }
              }
            } else if (D === w) {
              g.runtimePaths = l();
            } else {
              r += F;
            }
          }
          return g;
        };
        function getValue(e, r = "i8") {
          if (r.endsWith("*")) {
            r = "*";
          }
          switch (r) {
            case "i1":
              return HEAP8[e];
            case "i8":
              return HEAP8[e];
            case "i16":
              return HEAP16[e >> 1];
            case "i32":
              return HEAP32[e >> 2];
            case "i64":
              return HEAP64[e >> 3];
            case "float":
              return HEAPF32[e >> 2];
            case "double":
              return HEAPF64[e >> 3];
            case "*":
              return HEAPU32[e >> 2];
            default:
              abort(`invalid type for getValue: ${r}`);
          }
        }
        var newDSO = (e, r, t) => {
          var n = {
            refcount: Infinity,
            name: e,
            exports: t,
            global: true
          };
          LDSO.loadedLibsByName[e] = n;
          if (r != null) {
            LDSO.loadedLibsByHandle[r] = n;
          }
          return n;
        };
        var LDSO = {
          loadedLibsByName: {},
          loadedLibsByHandle: {},
          init() {
            newDSO("__main__", 0, wasmImports);
          }
        };
        var alignMemory = (e, r) => Math.ceil(e / r) * r;
        var getMemory = e => {
          if (runtimeInitialized) {
            return _calloc(e, 1);
          }
          var r = ___heap_base;
          var t = r + alignMemory(e, 16);
          ___heap_base = t;
          var n = _emscripten_get_sbrk_ptr();
          HEAPU32[n >> 2] = t;
          return r;
        };
        var isInternalSym = e => ["memory", "__memory_base", "__table_base", "__stack_pointer", "__indirect_function_table", "__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(e) || e.startsWith("__em_js__");
        var getWasmTableEntry = e => wasmTable.get(e);
        var updateTableMap = (e, r) => {
          if (functionsInTableMap) {
            for (var t = e; t < e + r; t++) {
              var n = getWasmTableEntry(t);
              if (n) {
                functionsInTableMap.set(n, t);
              }
            }
          }
        };
        var functionsInTableMap;
        var getFunctionAddress = e => {
          if (!functionsInTableMap) {
            functionsInTableMap = new WeakMap();
            updateTableMap(0, wasmTable.length);
          }
          return functionsInTableMap.get(e) || 0;
        };
        var freeTableIndexes = [];
        var getEmptyTableSlot = () => freeTableIndexes.length ? freeTableIndexes.pop() : wasmTable.grow(1);
        var setWasmTableEntry = (e, r) => wasmTable.set(e, r);
        var uleb128EncodeWithLen = e => {
          let r = e.length;
          return [r % 128 | 128, r >> 7, ...e];
        };
        var wasmTypeCodes = {
          i: 127,
          p: 127,
          j: 126,
          f: 125,
          d: 124,
          e: 111
        };
        var generateTypePack = e => uleb128EncodeWithLen(Array.from(e, r => {
          var t = wasmTypeCodes[r];
          return t;
        }));
        var convertJsFunctionToWasm = (e, r) => {
          var t = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...uleb128EncodeWithLen([1, 96, ...generateTypePack(r.slice(1)), ...generateTypePack(r[0] === "v" ? "" : r[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
          var n = new WebAssembly.Module(t);
          var a = new WebAssembly.Instance(n, {
            e: {
              f: e
            }
          });
          var o = a.exports.f;
          return o;
        };
        var addFunction = (e, r) => {
          var t = getFunctionAddress(e);
          if (t) {
            return t;
          }
          var n = getEmptyTableSlot();
          try {
            setWasmTableEntry(n, e);
          } catch (o) {
            if (!(o instanceof TypeError)) {
              throw o;
            }
            var a = convertJsFunctionToWasm(e, r);
            setWasmTableEntry(n, a);
          }
          functionsInTableMap.set(e, n);
          return n;
        };
        var updateGOT = (e, r) => {
          for (var t in e) {
            if (!isInternalSym(t)) {
              var n = e[t];
              var a = GOT[t] && GOT[t].value != -1;
              if (r || !a) {
                var o;
                if (typeof n == "function") {
                  o = addFunction(n);
                } else if (typeof n.value == "number") {
                  o = n;
                } else {
                  continue;
                }
                GOT[t] ??= new WebAssembly.Global({
                  value: "i32",
                  mutable: true
                });
                GOT[t].value = o;
              }
            }
          }
        };
        var isImmutableGlobal = e => {
          if (e instanceof WebAssembly.Global) {
            try {
              e.value = e.value;
            } catch {
              return true;
            }
          }
          return false;
        };
        var relocateExports = (e, r = 0) => {
          function t(o, l) {
            if (isImmutableGlobal(l)) {
              return new WebAssembly.Global({
                value: "i32"
              }, l.value + r);
            } else {
              return l;
            }
          }
          var n = {};
          for (var a in e) {
            n[a] = t(a, e[a]);
          }
          return n;
        };
        var isSymbolDefined = e => {
          var r = wasmImports[e];
          return !!r && !r.stub;
        };
        var createNamedFunction = (e, r) => Object.defineProperty(r, "name", {
          value: e
        });
        var dynCall = (e, r, t = [], n = false) => {
          var a = getWasmTableEntry(r);
          var o = a(...t);
          function l(c) {
            return c;
          }
          return o;
        };
        var stackSave = () => _emscripten_stack_get_current();
        var stackRestore = e => __emscripten_stack_restore(e);
        var createInvokeFunction = e => (r, ...t) => {
          var n = stackSave();
          try {
            return dynCall(e, r, t);
          } catch (a) {
            stackRestore(n);
            if (a !== a + 0) {
              throw a;
            }
            _setThrew(1, 0);
            if (e[0] == "j") {
              return 0n;
            }
          }
        };
        var resolveGlobalSymbol = (e, r = false) => {
          var t;
          if (isSymbolDefined(e)) {
            t = wasmImports[e];
          } else if (e.startsWith("invoke_")) {
            t = wasmImports[e] = createNamedFunction(e, createInvokeFunction(e.split("_")[1]));
          }
          return {
            sym: t,
            name: e
          };
        };
        var onPostCtors = [];
        var addOnPostCtor = e => onPostCtors.push(e);
        var UTF8ToString = (e, r, t) => {
          if (!e) {
            return "";
          }
          var n = findStringEnd(HEAPU8, e, r, t);
          return UTF8Decoder.decode(HEAPU8.subarray(e, n));
        };
        var loadWebAssemblyModule = (binary, flags, libName, localScope, handle) => {
          var metadata = getDylinkMetadata(binary);
          function loadModule() {
            var memAlign = Math.pow(2, metadata.memoryAlign);
            var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
            var tableBase = metadata.tableSize ? wasmTable.length : 0;
            if (handle) {
              HEAP8[handle + 8] = 1;
              HEAPU32[handle + 12 >> 2] = memoryBase;
              HEAP32[handle + 16 >> 2] = metadata.memorySize;
              HEAPU32[handle + 20 >> 2] = tableBase;
              HEAP32[handle + 24 >> 2] = metadata.tableSize;
            }
            if (metadata.tableSize) {
              wasmTable.grow(metadata.tableSize);
            }
            var moduleExports;
            function resolveSymbol(e) {
              var r = resolveGlobalSymbol(e).sym;
              if (!r && localScope) {
                r = localScope[e];
              }
              r ||= moduleExports[e];
              return r;
            }
            var proxyHandler = {
              get(e, r) {
                switch (r) {
                  case "__memory_base":
                    return memoryBase;
                  case "__table_base":
                    return tableBase;
                }
                if (r in wasmImports && !wasmImports[r].stub) {
                  var t = wasmImports[r];
                  return t;
                }
                if (!(r in e)) {
                  var n;
                  e[r] = (...a) => {
                    n ||= resolveSymbol(r);
                    return n(...a);
                  };
                }
                return e[r];
              }
            };
            var proxy = new Proxy({}, proxyHandler);
            var GOTProxy = new Proxy(metadata.weakImports, GOTHandler);
            var info = {
              "GOT.mem": GOTProxy,
              "GOT.func": GOTProxy,
              env: proxy,
              wasi_snapshot_preview1: proxy
            };
            function postInstantiation(module, instance) {
              updateTableMap(tableBase, metadata.tableSize);
              moduleExports = relocateExports(instance.exports, memoryBase);
              updateGOT(moduleExports);
              if (!flags.allowUndefined) {
                reportUndefinedSymbols();
              }
              function addEmAsm(addr, body) {
                var args = [];
                for (var arity = 0;; arity++) {
                  var argName = "$" + arity;
                  if (!body.includes(argName)) {
                    break;
                  }
                  args.push(argName);
                }
                args = args.join(",");
                var func = `(${args}) => { ${body} };`;
                ASM_CONSTS[start] = eval(func);
              }
              if ("__start_em_asm" in moduleExports) {
                for (var start = moduleExports.__start_em_asm.value, stop = moduleExports.__stop_em_asm.value; start < stop;) {
                  var jsString = UTF8ToString(start);
                  addEmAsm(start, jsString);
                  start = HEAPU8.indexOf(0, start) + 1;
                }
              }
              function addEmJs(name, cSig, body) {
                var jsArgs = [];
                cSig = cSig.slice(1, -1);
                if (cSig != "void") {
                  cSig = cSig.split(",");
                  for (var arg of cSig) {
                    var jsArg = arg.split(" ").pop();
                    jsArgs.push(jsArg.replaceAll("*", ""));
                  }
                }
                var func = `(${jsArgs}) => ${body};`;
                moduleExports[name] = eval(func);
              }
              for (var name in moduleExports) {
                if (name.startsWith("__em_js__")) {
                  var start = moduleExports[name].value;
                  var jsString = UTF8ToString(start);
                  var [sig, body] = jsString.split("<::>");
                  addEmJs(name.replace("__em_js__", ""), sig, body);
                  delete moduleExports[name];
                }
              }
              var applyRelocs = moduleExports.__wasm_apply_data_relocs;
              if (applyRelocs) {
                if (runtimeInitialized) {
                  applyRelocs();
                } else {
                  __RELOC_FUNCS__.push(applyRelocs);
                }
              }
              var init = moduleExports.__wasm_call_ctors;
              if (init) {
                if (runtimeInitialized) {
                  init();
                } else {
                  addOnPostCtor(init);
                }
              }
              return moduleExports;
            }
            if (flags.loadAsync) {
              return (async () => {
                var e;
                if (binary instanceof WebAssembly.Module) {
                  e = new WebAssembly.Instance(binary, info);
                } else {
                  ({
                    module: binary,
                    instance: e
                  } = await WebAssembly.instantiate(binary, info));
                }
                return postInstantiation(binary, e);
              })();
            }
            var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return postInstantiation(module, instance);
          }
          flags = {
            ...flags,
            rpath: {
              parentLibPath: libName,
              paths: metadata.runtimePaths
            }
          };
          if (flags.loadAsync) {
            return metadata.neededDynlibs.reduce((e, r) => e.then(() => {
              r = findLibraryFS(r, flags.rpath) ?? r;
              return loadDynamicLibrary(r, flags, localScope);
            }), Promise.resolve()).then(loadModule);
          }
          for (var needed of metadata.neededDynlibs) {
            needed = findLibraryFS(needed, flags.rpath) ?? needed;
            loadDynamicLibrary(needed, flags, localScope);
          }
          return loadModule();
        };
        var mergeLibSymbols = (e, r) => {
          for (var [t, n] of Object.entries(e)) {
            let a = l => {
              if (!isSymbolDefined(l)) {
                wasmImports[l] = n;
              }
            };
            a(t);
            let o = "__main_argc_argv";
            if (t == "main") {
              a(o);
            }
            if (t == o) {
              a("main");
            }
          }
        };
        var asyncLoad = async e => {
          var r = await readAsync(e);
          return new Uint8Array(r);
        };
        var preloadPlugins = [];
        var registerWasmPlugin = () => {
          var e = {
            promiseChainEnd: Promise.resolve(),
            canHandle: r => !Module.noWasmDecoding && r.endsWith(".so"),
            handle: async (r, t) => e.promiseChainEnd = e.promiseChainEnd.then(async () => {
              try {
                var n = await loadWebAssemblyModule(r, {
                  loadAsync: true,
                  nodelete: true
                }, t, {});
              } catch (a) {
                throw new Error(`failed to instantiate wasm: ${t}: ${a}`);
              }
              preloadedWasm[t] = n;
              return r;
            })
          };
          preloadPlugins.push(e);
        };
        var preloadedWasm = {};
        var PATH = {
          isAbs: e => e.charAt(0) === "/",
          splitPath: e => {
            var r = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
            return r.exec(e).slice(1);
          },
          normalizeArray: (e, r) => {
            var t = 0;
            for (var n = e.length - 1; n >= 0; n--) {
              var a = e[n];
              if (a === ".") {
                e.splice(n, 1);
              } else if (a === "..") {
                e.splice(n, 1);
                t++;
              } else if (t) {
                e.splice(n, 1);
                t--;
              }
            }
            if (r) {
              for (; t; t--) {
                e.unshift("..");
              }
            }
            return e;
          },
          normalize: e => {
            var r = PATH.isAbs(e);
            var t = e.slice(-1) === "/";
            e = PATH.normalizeArray(e.split("/").filter(n => !!n), !r).join("/");
            if (!e && !r) {
              e = ".";
            }
            if (e && t) {
              e += "/";
            }
            return (r ? "/" : "") + e;
          },
          dirname: e => {
            var r = PATH.splitPath(e);
            var t = r[0];
            var n = r[1];
            if (!t && !n) {
              return ".";
            } else {
              n &&= n.slice(0, -1);
              return t + n;
            }
          },
          basename: e => e && e.match(/([^\/]+|\/)\/*$/)[1],
          join: (...e) => PATH.normalize(e.join("/")),
          join2: (e, r) => PATH.normalize(e + "/" + r)
        };
        var replaceORIGIN = (e, r) => {
          if (r.startsWith("$ORIGIN")) {
            var t = PATH.dirname(e);
            return r.replace("$ORIGIN", t);
          }
          return r;
        };
        var withStackSave = e => {
          var r = stackSave();
          var t = e();
          stackRestore(r);
          return t;
        };
        var stackAlloc = e => __emscripten_stack_alloc(e);
        var lengthBytesUTF8 = e => {
          var r = 0;
          for (var t = 0; t < e.length; ++t) {
            var n = e.charCodeAt(t);
            if (n <= 127) {
              r++;
            } else if (n <= 2047) {
              r += 2;
            } else if (n >= 55296 && n <= 57343) {
              r += 4;
              ++t;
            } else {
              r += 3;
            }
          }
          return r;
        };
        var stringToUTF8Array = (e, r, t, n) => {
          if (!(n > 0)) {
            return 0;
          }
          var a = t;
          var o = t + n - 1;
          for (var l = 0; l < e.length; ++l) {
            var c = e.codePointAt(l);
            if (c <= 127) {
              if (t >= o) {
                break;
              }
              r[t++] = c;
            } else if (c <= 2047) {
              if (t + 1 >= o) {
                break;
              }
              r[t++] = c >> 6 | 192;
              r[t++] = c & 63 | 128;
            } else if (c <= 65535) {
              if (t + 2 >= o) {
                break;
              }
              r[t++] = c >> 12 | 224;
              r[t++] = c >> 6 & 63 | 128;
              r[t++] = c & 63 | 128;
            } else {
              if (t + 3 >= o) {
                break;
              }
              r[t++] = c >> 18 | 240;
              r[t++] = c >> 12 & 63 | 128;
              r[t++] = c >> 6 & 63 | 128;
              r[t++] = c & 63 | 128;
              l++;
            }
          }
          r[t] = 0;
          return t - a;
        };
        var stringToUTF8 = (e, r, t) => stringToUTF8Array(e, HEAPU8, r, t);
        var stringToUTF8OnStack = e => {
          var r = lengthBytesUTF8(e) + 1;
          var t = stackAlloc(r);
          stringToUTF8(e, t, r);
          return t;
        };
        var initRandomFill = () => e => crypto.getRandomValues(e);
        var randomFill = e => {
          (randomFill = initRandomFill())(e);
        };
        var PATH_FS = {
          resolve: (...e) => {
            var r = "";
            for (var t = false, n = e.length - 1; n >= -1 && !t; n--) {
              var a = n >= 0 ? e[n] : FS.cwd();
              if (typeof a != "string") {
                throw new TypeError("Arguments to path.resolve must be strings");
              }
              if (!a) {
                return "";
              }
              r = a + "/" + r;
              t = PATH.isAbs(a);
            }
            r = PATH.normalizeArray(r.split("/").filter(o => !!o), !t).join("/");
            return (t ? "/" : "") + r || ".";
          },
          relative: (e, r) => {
            e = PATH_FS.resolve(e).slice(1);
            r = PATH_FS.resolve(r).slice(1);
            function t(u) {
              for (var m = 0; m < u.length && u[m] === ""; m++);
              for (var f = u.length - 1; f >= 0 && u[f] === ""; f--);
              if (m > f) {
                return [];
              } else {
                return u.slice(m, f - m + 1);
              }
            }
            var n = t(e.split("/"));
            var a = t(r.split("/"));
            for (var o = Math.min(n.length, a.length), l = o, c = 0; c < o; c++) {
              if (n[c] !== a[c]) {
                l = c;
                break;
              }
            }
            var _ = [];
            for (var c = l; c < n.length; c++) {
              _.push("..");
            }
            _ = _.concat(a.slice(l));
            return _.join("/");
          }
        };
        var FS_stdin_getChar_buffer = [];
        var intArrayFromString = (e, r, t) => {
          var n = t > 0 ? t : lengthBytesUTF8(e) + 1;
          var a = new Array(n);
          var o = stringToUTF8Array(e, a, 0, a.length);
          if (r) {
            a.length = o;
          }
          return a;
        };
        var FS_stdin_getChar = () => {
          if (!FS_stdin_getChar_buffer.length) {
            var e = null;
            if (globalThis.window?.prompt) {
              e = window.prompt("Input: ");
              if (e !== null) {
                e += `
`;
              }
            }
            if (!e) {
              return null;
            }
            FS_stdin_getChar_buffer = intArrayFromString(e, true);
          }
          return FS_stdin_getChar_buffer.shift();
        };
        var TTY = {
          ttys: [],
          init() {},
          shutdown() {},
          register(e, r) {
            TTY.ttys[e] = {
              input: [],
              output: [],
              ops: r
            };
            FS.registerDevice(e, TTY.stream_ops);
          },
          stream_ops: {
            open(e) {
              var r = TTY.ttys[e.node.rdev];
              if (!r) {
                throw new FS.ErrnoError(43);
              }
              e.tty = r;
              e.seekable = false;
            },
            close(e) {
              e.tty.ops.fsync(e.tty);
            },
            fsync(e) {
              e.tty.ops.fsync(e.tty);
            },
            read(e, r, t, n, a) {
              if (!e.tty || !e.tty.ops.get_char) {
                throw new FS.ErrnoError(60);
              }
              var o = 0;
              for (var l = 0; l < n; l++) {
                var c;
                try {
                  c = e.tty.ops.get_char(e.tty);
                } catch {
                  throw new FS.ErrnoError(29);
                }
                if (c === undefined && o === 0) {
                  throw new FS.ErrnoError(6);
                }
                if (c == null) {
                  break;
                }
                o++;
                r[t + l] = c;
              }
              if (o) {
                e.node.atime = Date.now();
              }
              return o;
            },
            write(e, r, t, n, a) {
              if (!e.tty || !e.tty.ops.put_char) {
                throw new FS.ErrnoError(60);
              }
              try {
                for (var o = 0; o < n; o++) {
                  e.tty.ops.put_char(e.tty, r[t + o]);
                }
              } catch {
                throw new FS.ErrnoError(29);
              }
              if (n) {
                e.node.mtime = e.node.ctime = Date.now();
              }
              return o;
            }
          },
          default_tty_ops: {
            get_char(e) {
              return FS_stdin_getChar();
            },
            put_char(e, r) {
              if (r === null || r === 10) {
                out(UTF8ArrayToString(e.output));
                e.output = [];
              } else if (r != 0) {
                e.output.push(r);
              }
            },
            fsync(e) {
              if (e.output?.length > 0) {
                out(UTF8ArrayToString(e.output));
                e.output = [];
              }
            },
            ioctl_tcgets(e) {
              return {
                c_iflag: 25856,
                c_oflag: 5,
                c_cflag: 191,
                c_lflag: 35387,
                c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
              };
            },
            ioctl_tcsets(e, r, t) {
              return 0;
            },
            ioctl_tiocgwinsz(e) {
              return [24, 80];
            }
          },
          default_tty1_ops: {
            put_char(e, r) {
              if (r === null || r === 10) {
                err(UTF8ArrayToString(e.output));
                e.output = [];
              } else if (r != 0) {
                e.output.push(r);
              }
            },
            fsync(e) {
              if (e.output?.length > 0) {
                err(UTF8ArrayToString(e.output));
                e.output = [];
              }
            }
          }
        };
        var zeroMemory = (e, r) => HEAPU8.fill(0, e, e + r);
        var mmapAlloc = e => {
          e = alignMemory(e, 65536);
          var r = _emscripten_builtin_memalign(65536, e);
          if (r) {
            zeroMemory(r, e);
          }
          return r;
        };
        var MEMFS = {
          ops_table: null,
          mount(e) {
            return MEMFS.createNode(null, "/", 16895, 0);
          },
          createNode(e, r, t, n) {
            if (FS.isBlkdev(t) || FS.isFIFO(t)) {
              throw new FS.ErrnoError(63);
            }
            MEMFS.ops_table ||= {
              dir: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  lookup: MEMFS.node_ops.lookup,
                  mknod: MEMFS.node_ops.mknod,
                  rename: MEMFS.node_ops.rename,
                  unlink: MEMFS.node_ops.unlink,
                  rmdir: MEMFS.node_ops.rmdir,
                  readdir: MEMFS.node_ops.readdir,
                  symlink: MEMFS.node_ops.symlink
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek
                }
              },
              file: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek,
                  read: MEMFS.stream_ops.read,
                  write: MEMFS.stream_ops.write,
                  mmap: MEMFS.stream_ops.mmap,
                  msync: MEMFS.stream_ops.msync
                }
              },
              link: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  readlink: MEMFS.node_ops.readlink
                },
                stream: {}
              },
              chrdev: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: FS.chrdev_stream_ops
              }
            };
            var a = FS.createNode(e, r, t, n);
            if (FS.isDir(a.mode)) {
              a.node_ops = MEMFS.ops_table.dir.node;
              a.stream_ops = MEMFS.ops_table.dir.stream;
              a.contents = {};
            } else if (FS.isFile(a.mode)) {
              a.node_ops = MEMFS.ops_table.file.node;
              a.stream_ops = MEMFS.ops_table.file.stream;
              a.usedBytes = 0;
              a.contents = null;
            } else if (FS.isLink(a.mode)) {
              a.node_ops = MEMFS.ops_table.link.node;
              a.stream_ops = MEMFS.ops_table.link.stream;
            } else if (FS.isChrdev(a.mode)) {
              a.node_ops = MEMFS.ops_table.chrdev.node;
              a.stream_ops = MEMFS.ops_table.chrdev.stream;
            }
            a.atime = a.mtime = a.ctime = Date.now();
            if (e) {
              e.contents[r] = a;
              e.atime = e.mtime = e.ctime = a.atime;
            }
            return a;
          },
          getFileDataAsTypedArray(e) {
            if (e.contents) {
              if (e.contents.subarray) {
                return e.contents.subarray(0, e.usedBytes);
              } else {
                return new Uint8Array(e.contents);
              }
            } else {
              return new Uint8Array(0);
            }
          },
          expandFileStorage(e, r) {
            var t = e.contents ? e.contents.length : 0;
            if (!(t >= r)) {
              var n = 1048576;
              r = Math.max(r, t * (t < n ? 2 : 1.125) >>> 0);
              if (t != 0) {
                r = Math.max(r, 256);
              }
              var a = e.contents;
              e.contents = new Uint8Array(r);
              if (e.usedBytes > 0) {
                e.contents.set(a.subarray(0, e.usedBytes), 0);
              }
            }
          },
          resizeFileStorage(e, r) {
            if (e.usedBytes != r) {
              if (r == 0) {
                e.contents = null;
                e.usedBytes = 0;
              } else {
                var t = e.contents;
                e.contents = new Uint8Array(r);
                if (t) {
                  e.contents.set(t.subarray(0, Math.min(r, e.usedBytes)));
                }
                e.usedBytes = r;
              }
            }
          },
          node_ops: {
            getattr(e) {
              var r = {};
              r.dev = FS.isChrdev(e.mode) ? e.id : 1;
              r.ino = e.id;
              r.mode = e.mode;
              r.nlink = 1;
              r.uid = 0;
              r.gid = 0;
              r.rdev = e.rdev;
              if (FS.isDir(e.mode)) {
                r.size = 4096;
              } else if (FS.isFile(e.mode)) {
                r.size = e.usedBytes;
              } else if (FS.isLink(e.mode)) {
                r.size = e.link.length;
              } else {
                r.size = 0;
              }
              r.atime = new Date(e.atime);
              r.mtime = new Date(e.mtime);
              r.ctime = new Date(e.ctime);
              r.blksize = 4096;
              r.blocks = Math.ceil(r.size / r.blksize);
              return r;
            },
            setattr(e, r) {
              for (let t of ["mode", "atime", "mtime", "ctime"]) {
                if (r[t] != null) {
                  e[t] = r[t];
                }
              }
              if (r.size !== undefined) {
                MEMFS.resizeFileStorage(e, r.size);
              }
            },
            lookup(e, r) {
              if (!MEMFS.doesNotExistError) {
                MEMFS.doesNotExistError = new FS.ErrnoError(44);
                MEMFS.doesNotExistError.stack = "<generic error, no stack>";
              }
              throw MEMFS.doesNotExistError;
            },
            mknod(e, r, t, n) {
              return MEMFS.createNode(e, r, t, n);
            },
            rename(e, r, t) {
              var n;
              try {
                n = FS.lookupNode(r, t);
              } catch {}
              if (n) {
                if (FS.isDir(e.mode)) {
                  for (var a in n.contents) {
                    throw new FS.ErrnoError(55);
                  }
                }
                FS.hashRemoveNode(n);
              }
              delete e.parent.contents[e.name];
              r.contents[t] = e;
              e.name = t;
              r.ctime = r.mtime = e.parent.ctime = e.parent.mtime = Date.now();
            },
            unlink(e, r) {
              delete e.contents[r];
              e.ctime = e.mtime = Date.now();
            },
            rmdir(e, r) {
              var t = FS.lookupNode(e, r);
              for (var n in t.contents) {
                throw new FS.ErrnoError(55);
              }
              delete e.contents[r];
              e.ctime = e.mtime = Date.now();
            },
            readdir(e) {
              return [".", "..", ...Object.keys(e.contents)];
            },
            symlink(e, r, t) {
              var n = MEMFS.createNode(e, r, 41471, 0);
              n.link = t;
              return n;
            },
            readlink(e) {
              if (!FS.isLink(e.mode)) {
                throw new FS.ErrnoError(28);
              }
              return e.link;
            }
          },
          stream_ops: {
            read(e, r, t, n, a) {
              var o = e.node.contents;
              if (a >= e.node.usedBytes) {
                return 0;
              }
              var l = Math.min(e.node.usedBytes - a, n);
              if (l > 8 && o.subarray) {
                r.set(o.subarray(a, a + l), t);
              } else {
                for (var c = 0; c < l; c++) {
                  r[t + c] = o[a + c];
                }
              }
              return l;
            },
            write(e, r, t, n, a, o) {
              if (!n) {
                return 0;
              }
              var l = e.node;
              l.mtime = l.ctime = Date.now();
              if (r.subarray && (!l.contents || l.contents.subarray)) {
                if (o) {
                  l.contents = r.subarray(t, t + n);
                  l.usedBytes = n;
                  return n;
                }
                if (l.usedBytes === 0 && a === 0) {
                  l.contents = r.slice(t, t + n);
                  l.usedBytes = n;
                  return n;
                }
                if (a + n <= l.usedBytes) {
                  l.contents.set(r.subarray(t, t + n), a);
                  return n;
                }
              }
              MEMFS.expandFileStorage(l, a + n);
              if (l.contents.subarray && r.subarray) {
                l.contents.set(r.subarray(t, t + n), a);
              } else {
                for (var c = 0; c < n; c++) {
                  l.contents[a + c] = r[t + c];
                }
              }
              l.usedBytes = Math.max(l.usedBytes, a + n);
              return n;
            },
            llseek(e, r, t) {
              var n = r;
              if (t === 1) {
                n += e.position;
              } else if (t === 2 && FS.isFile(e.node.mode)) {
                n += e.node.usedBytes;
              }
              if (n < 0) {
                throw new FS.ErrnoError(28);
              }
              return n;
            },
            mmap(e, r, t, n, a) {
              if (!FS.isFile(e.node.mode)) {
                throw new FS.ErrnoError(43);
              }
              var o;
              var l;
              var c = e.node.contents;
              if (!(a & 2) && c && c.buffer === HEAP8.buffer) {
                l = false;
                o = c.byteOffset;
              } else {
                l = true;
                o = mmapAlloc(r);
                if (!o) {
                  throw new FS.ErrnoError(48);
                }
                if (c) {
                  if (t > 0 || t + r < c.length) {
                    if (c.subarray) {
                      c = c.subarray(t, t + r);
                    } else {
                      c = Array.prototype.slice.call(c, t, t + r);
                    }
                  }
                  HEAP8.set(c, o);
                }
              }
              return {
                ptr: o,
                allocated: l
              };
            },
            msync(e, r, t, n, a) {
              MEMFS.stream_ops.write(e, r, 0, n, t, false);
              return 0;
            }
          }
        };
        var FS_modeStringToFlags = e => {
          var r = {
            r: 0,
            "r+": 2,
            w: 577,
            "w+": 578,
            a: 1089,
            "a+": 1090
          };
          var t = r[e];
          if (typeof t === "undefined") {
            throw new Error(`Unknown file open mode: ${e}`);
          }
          return t;
        };
        var FS_getMode = (e, r) => {
          var t = 0;
          if (e) {
            t |= 365;
          }
          if (r) {
            t |= 146;
          }
          return t;
        };
        var IDBFS = {
          dbs: {},
          indexedDB: () => indexedDB,
          DB_VERSION: 21,
          DB_STORE_NAME: "FILE_DATA",
          queuePersist: e => {
            function r() {
              if (e.idbPersistState === "again") {
                t();
              } else {
                e.idbPersistState = 0;
              }
            }
            function t() {
              e.idbPersistState = "idb";
              IDBFS.syncfs(e, false, r);
            }
            if (e.idbPersistState) {
              if (e.idbPersistState === "idb") {
                e.idbPersistState = "again";
              }
            } else {
              e.idbPersistState = setTimeout(t, 0);
            }
          },
          mount: e => {
            var r = MEMFS.mount(e);
            if (e?.opts?.autoPersist) {
              e.idbPersistState = 0;
              var t = r.node_ops;
              r.node_ops = {
                ...r.node_ops
              };
              r.node_ops.mknod = (n, a, o, l) => {
                var c = t.mknod(n, a, o, l);
                c.node_ops = r.node_ops;
                c.idbfs_mount = r.mount;
                c.memfs_stream_ops = c.stream_ops;
                c.stream_ops = {
                  ...c.stream_ops
                };
                c.stream_ops.write = (_, u, m, f, v, g) => {
                  _.node.isModified = true;
                  return c.memfs_stream_ops.write(_, u, m, f, v, g);
                };
                c.stream_ops.close = _ => {
                  var u = _.node;
                  if (u.isModified) {
                    IDBFS.queuePersist(u.idbfs_mount);
                    u.isModified = false;
                  }
                  if (u.memfs_stream_ops.close) {
                    return u.memfs_stream_ops.close(_);
                  }
                };
                IDBFS.queuePersist(r.mount);
                return c;
              };
              r.node_ops.rmdir = (...n) => {
                IDBFS.queuePersist(r.mount);
                return t.rmdir(...n);
              };
              r.node_ops.symlink = (...n) => {
                IDBFS.queuePersist(r.mount);
                return t.symlink(...n);
              };
              r.node_ops.unlink = (...n) => {
                IDBFS.queuePersist(r.mount);
                return t.unlink(...n);
              };
              r.node_ops.rename = (...n) => {
                IDBFS.queuePersist(r.mount);
                return t.rename(...n);
              };
            }
            return r;
          },
          syncfs: (e, r, t) => {
            IDBFS.getLocalSet(e, (n, a) => {
              if (n) {
                return t(n);
              }
              IDBFS.getRemoteSet(e, (o, l) => {
                if (o) {
                  return t(o);
                }
                var c = r ? l : a;
                var _ = r ? a : l;
                IDBFS.reconcile(c, _, t);
              });
            });
          },
          quit: () => {
            for (var e of Object.values(IDBFS.dbs)) {
              e.close();
            }
            IDBFS.dbs = {};
          },
          getDB: (e, r) => {
            var t = IDBFS.dbs[e];
            if (t) {
              return r(null, t);
            }
            var n;
            try {
              n = IDBFS.indexedDB().open(e, IDBFS.DB_VERSION);
            } catch (a) {
              return r(a);
            }
            if (!n) {
              return r("Unable to connect to IndexedDB");
            }
            n.onupgradeneeded = a => {
              var o = a.target.result;
              var l = a.target.transaction;
              var c;
              if (o.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                c = l.objectStore(IDBFS.DB_STORE_NAME);
              } else {
                c = o.createObjectStore(IDBFS.DB_STORE_NAME);
              }
              if (!c.indexNames.contains("timestamp")) {
                c.createIndex("timestamp", "timestamp", {
                  unique: false
                });
              }
            };
            n.onsuccess = () => {
              t = n.result;
              IDBFS.dbs[e] = t;
              r(null, t);
            };
            n.onerror = a => {
              r(a.target.error);
              a.preventDefault();
            };
          },
          getLocalSet: (e, r) => {
            var t = {};
            function n(_) {
              return _ !== "." && _ !== "..";
            }
            function a(_) {
              return u => PATH.join2(_, u);
            }
            for (var o = FS.readdir(e.mountpoint).filter(n).map(a(e.mountpoint)); o.length;) {
              var l = o.pop();
              var c;
              try {
                c = FS.stat(l);
              } catch (_) {
                return r(_);
              }
              if (FS.isDir(c.mode)) {
                o.push(...FS.readdir(l).filter(n).map(a(l)));
              }
              t[l] = {
                timestamp: c.mtime
              };
            }
            return r(null, {
              type: "local",
              entries: t
            });
          },
          getRemoteSet: (e, r) => {
            var t = {};
            IDBFS.getDB(e.mountpoint, (n, a) => {
              if (n) {
                return r(n);
              }
              try {
                var o = a.transaction([IDBFS.DB_STORE_NAME], "readonly");
                o.onerror = _ => {
                  r(_.target.error);
                  _.preventDefault();
                };
                var l = o.objectStore(IDBFS.DB_STORE_NAME);
                var c = l.index("timestamp");
                c.openKeyCursor().onsuccess = _ => {
                  var u = _.target.result;
                  if (!u) {
                    return r(null, {
                      type: "remote",
                      db: a,
                      entries: t
                    });
                  }
                  t[u.primaryKey] = {
                    timestamp: u.key
                  };
                  u.continue();
                };
              } catch (_) {
                return r(_);
              }
            });
          },
          loadLocalEntry: (e, r) => {
            var t;
            var n;
            try {
              var a = FS.lookupPath(e);
              n = a.node;
              t = FS.stat(e);
            } catch (o) {
              return r(o);
            }
            if (FS.isDir(t.mode)) {
              return r(null, {
                timestamp: t.mtime,
                mode: t.mode
              });
            } else if (FS.isFile(t.mode)) {
              n.contents = MEMFS.getFileDataAsTypedArray(n);
              return r(null, {
                timestamp: t.mtime,
                mode: t.mode,
                contents: n.contents
              });
            } else {
              return r(new Error("node type not supported"));
            }
          },
          storeLocalEntry: (e, r, t) => {
            try {
              if (FS.isDir(r.mode)) {
                FS.mkdirTree(e, r.mode);
              } else if (FS.isFile(r.mode)) {
                FS.writeFile(e, r.contents, {
                  canOwn: true
                });
              } else {
                return t(new Error("node type not supported"));
              }
              FS.chmod(e, r.mode);
              FS.utime(e, r.timestamp, r.timestamp);
            } catch (n) {
              return t(n);
            }
            t(null);
          },
          removeLocalEntry: (e, r) => {
            try {
              var t = FS.stat(e);
              if (FS.isDir(t.mode)) {
                FS.rmdir(e);
              } else if (FS.isFile(t.mode)) {
                FS.unlink(e);
              }
            } catch (n) {
              return r(n);
            }
            r(null);
          },
          loadRemoteEntry: (e, r, t) => {
            var n = e.get(r);
            n.onsuccess = a => t(null, a.target.result);
            n.onerror = a => {
              t(a.target.error);
              a.preventDefault();
            };
          },
          storeRemoteEntry: (e, r, t, n) => {
            try {
              var a = e.put(t, r);
            } catch (o) {
              n(o);
              return;
            }
            a.onsuccess = o => n();
            a.onerror = o => {
              n(o.target.error);
              o.preventDefault();
            };
          },
          removeRemoteEntry: (e, r, t) => {
            var n = e.delete(r);
            n.onsuccess = a => t();
            n.onerror = a => {
              t(a.target.error);
              a.preventDefault();
            };
          },
          reconcile: (e, r, t) => {
            var n = 0;
            var a = [];
            for (var [o, l] of Object.entries(e.entries)) {
              var c = r.entries[o];
              if (!c || l.timestamp.getTime() != c.timestamp.getTime()) {
                a.push(o);
                n++;
              }
            }
            var _ = [];
            for (var o of Object.keys(r.entries)) {
              if (!e.entries[o]) {
                _.push(o);
                n++;
              }
            }
            if (!n) {
              return t(null);
            }
            var u = false;
            var m = e.type === "remote" ? e.db : r.db;
            var f = m.transaction([IDBFS.DB_STORE_NAME], "readwrite");
            var v = f.objectStore(IDBFS.DB_STORE_NAME);
            function g(p) {
              if (p && !u) {
                u = true;
                return t(p);
              }
            }
            f.onerror = f.onabort = p => {
              g(p.target.error);
              p.preventDefault();
            };
            f.oncomplete = p => {
              if (!u) {
                t(null);
              }
            };
            for (let p of a.sort()) {
              if (r.type === "local") {
                IDBFS.loadRemoteEntry(v, p, (b, S) => {
                  if (b) {
                    return g(b);
                  }
                  IDBFS.storeLocalEntry(p, S, g);
                });
              } else {
                IDBFS.loadLocalEntry(p, (b, S) => {
                  if (b) {
                    return g(b);
                  }
                  IDBFS.storeRemoteEntry(v, p, S, g);
                });
              }
            }
            for (var h of _.sort().reverse()) {
              if (r.type === "local") {
                IDBFS.removeLocalEntry(h, g);
              } else {
                IDBFS.removeRemoteEntry(v, h, g);
              }
            }
          }
        };
        var FS_createDataFile = (...e) => FS.createDataFile(...e);
        var getUniqueRunDependency = e => e;
        var runDependencies = 0;
        var dependenciesFulfilled = null;
        var removeRunDependency = e => {
          runDependencies--;
          Module.monitorRunDependencies?.(runDependencies);
          if (runDependencies == 0 && dependenciesFulfilled) {
            var r = dependenciesFulfilled;
            dependenciesFulfilled = null;
            r();
          }
        };
        var addRunDependency = e => {
          runDependencies++;
          Module.monitorRunDependencies?.(runDependencies);
        };
        var FS_handledByPreloadPlugin = async (e, r) => {
          if (typeof Browser !== "undefined") {
            Browser.init();
          }
          for (var t of preloadPlugins) {
            if (t.canHandle(r)) {
              return t.handle(e, r);
            }
          }
          return e;
        };
        var FS_preloadFile = async (e, r, t, n, a, o, l, c) => {
          var _ = r ? PATH_FS.resolve(PATH.join2(e, r)) : e;
          var u = getUniqueRunDependency(`cp ${_}`);
          addRunDependency(u);
          try {
            var m = t;
            if (typeof t == "string") {
              m = await asyncLoad(t);
            }
            m = await FS_handledByPreloadPlugin(m, _);
            c?.();
            if (!o) {
              FS_createDataFile(e, r, m, n, a, l);
            }
          } finally {
            removeRunDependency(u);
          }
        };
        var FS_createPreloadedFile = (e, r, t, n, a, o, l, c, _, u) => {
          FS_preloadFile(e, r, t, n, a, c, _, u).then(o).catch(l);
        };
        var FS = {
          root: null,
          mounts: [],
          devices: {},
          streams: [],
          nextInode: 1,
          nameTable: null,
          currentPath: "/",
          initialized: false,
          ignorePermissions: true,
          filesystems: null,
          syncFSRequests: 0,
          readFiles: {},
          ErrnoError: class {
            constructor(e) {
              this.name = "ErrnoError";
              this.errno = e;
            }
          },
          FSStream: class {
            constructor() {
              this.shared = {};
            }
            get object() {
              return this.node;
            }
            set object(e) {
              this.node = e;
            }
            get isRead() {
              return (this.flags & 2097155) !== 1;
            }
            get isWrite() {
              return (this.flags & 2097155) !== 0;
            }
            get isAppend() {
              return this.flags & 1024;
            }
            get flags() {
              return this.shared.flags;
            }
            set flags(e) {
              this.shared.flags = e;
            }
            get position() {
              return this.shared.position;
            }
            set position(e) {
              this.shared.position = e;
            }
          },
          FSNode: class {
            constructor(e, r, t, n) {
              this.node_ops = {};
              this.stream_ops = {};
              this.readMode = 365;
              this.writeMode = 146;
              this.mounted = null;
              e ||= this;
              this.parent = e;
              this.mount = e.mount;
              this.id = FS.nextInode++;
              this.name = r;
              this.mode = t;
              this.rdev = n;
              this.atime = this.mtime = this.ctime = Date.now();
            }
            get read() {
              return (this.mode & this.readMode) === this.readMode;
            }
            set read(e) {
              if (e) {
                this.mode |= this.readMode;
              } else {
                this.mode &= ~this.readMode;
              }
            }
            get write() {
              return (this.mode & this.writeMode) === this.writeMode;
            }
            set write(e) {
              if (e) {
                this.mode |= this.writeMode;
              } else {
                this.mode &= ~this.writeMode;
              }
            }
            get isFolder() {
              return FS.isDir(this.mode);
            }
            get isDevice() {
              return FS.isChrdev(this.mode);
            }
          },
          lookupPath(e, r = {}) {
            if (!e) {
              throw new FS.ErrnoError(44);
            }
            r.follow_mount ??= true;
            if (!PATH.isAbs(e)) {
              e = FS.cwd() + "/" + e;
            }
            e: for (var t = 0; t < 40; t++) {
              for (var n = e.split("/").filter(u => !!u), a = FS.root, o = "/", l = 0; l < n.length; l++) {
                var c = l === n.length - 1;
                if (c && r.parent) {
                  break;
                }
                if (n[l] !== ".") {
                  if (n[l] === "..") {
                    o = PATH.dirname(o);
                    if (FS.isRoot(a)) {
                      e = o + "/" + n.slice(l + 1).join("/");
                      t--;
                      continue e;
                    } else {
                      a = a.parent;
                    }
                    continue;
                  }
                  o = PATH.join2(o, n[l]);
                  try {
                    a = FS.lookupNode(a, n[l]);
                  } catch (u) {
                    if (u?.errno === 44 && c && r.noent_okay) {
                      return {
                        path: o
                      };
                    }
                    throw u;
                  }
                  if (FS.isMountpoint(a) && (!c || r.follow_mount)) {
                    a = a.mounted.root;
                  }
                  if (FS.isLink(a.mode) && (!c || r.follow)) {
                    if (!a.node_ops.readlink) {
                      throw new FS.ErrnoError(52);
                    }
                    var _ = a.node_ops.readlink(a);
                    if (!PATH.isAbs(_)) {
                      _ = PATH.dirname(o) + "/" + _;
                    }
                    e = _ + "/" + n.slice(l + 1).join("/");
                    continue e;
                  }
                }
              }
              return {
                path: o,
                node: a
              };
            }
            throw new FS.ErrnoError(32);
          },
          getPath(e) {
            var r;
            for (;;) {
              if (FS.isRoot(e)) {
                var t = e.mount.mountpoint;
                if (r) {
                  if (t[t.length - 1] !== "/") {
                    return `${t}/${r}`;
                  } else {
                    return t + r;
                  }
                } else {
                  return t;
                }
              }
              r = r ? `${e.name}/${r}` : e.name;
              e = e.parent;
            }
          },
          hashName(e, r) {
            var t = 0;
            for (var n = 0; n < r.length; n++) {
              t = (t << 5) - t + r.charCodeAt(n) | 0;
            }
            return (e + t >>> 0) % FS.nameTable.length;
          },
          hashAddNode(e) {
            var r = FS.hashName(e.parent.id, e.name);
            e.name_next = FS.nameTable[r];
            FS.nameTable[r] = e;
          },
          hashRemoveNode(e) {
            var r = FS.hashName(e.parent.id, e.name);
            if (FS.nameTable[r] === e) {
              FS.nameTable[r] = e.name_next;
            } else {
              for (var t = FS.nameTable[r]; t;) {
                if (t.name_next === e) {
                  t.name_next = e.name_next;
                  break;
                }
                t = t.name_next;
              }
            }
          },
          lookupNode(e, r) {
            var t = FS.mayLookup(e);
            if (t) {
              throw new FS.ErrnoError(t);
            }
            var n = FS.hashName(e.id, r);
            for (var a = FS.nameTable[n]; a; a = a.name_next) {
              var o = a.name;
              if (a.parent.id === e.id && o === r) {
                return a;
              }
            }
            return FS.lookup(e, r);
          },
          createNode(e, r, t, n) {
            var a = new FS.FSNode(e, r, t, n);
            FS.hashAddNode(a);
            return a;
          },
          destroyNode(e) {
            FS.hashRemoveNode(e);
          },
          isRoot(e) {
            return e === e.parent;
          },
          isMountpoint(e) {
            return !!e.mounted;
          },
          isFile(e) {
            return (e & 61440) === 32768;
          },
          isDir(e) {
            return (e & 61440) === 16384;
          },
          isLink(e) {
            return (e & 61440) === 40960;
          },
          isChrdev(e) {
            return (e & 61440) === 8192;
          },
          isBlkdev(e) {
            return (e & 61440) === 24576;
          },
          isFIFO(e) {
            return (e & 61440) === 4096;
          },
          isSocket(e) {
            return (e & 49152) === 49152;
          },
          flagsToPermissionString(e) {
            var r = ["r", "w", "rw"][e & 3];
            if (e & 512) {
              r += "w";
            }
            return r;
          },
          nodePermissions(e, r) {
            if (FS.ignorePermissions) {
              return 0;
            } else if (r.includes("r") && !(e.mode & 292) || r.includes("w") && !(e.mode & 146) || r.includes("x") && !(e.mode & 73)) {
              return 2;
            } else {
              return 0;
            }
          },
          mayLookup(e) {
            if (!FS.isDir(e.mode)) {
              return 54;
            }
            var r = FS.nodePermissions(e, "x");
            return r || (e.node_ops.lookup ? 0 : 2);
          },
          mayCreate(e, r) {
            if (!FS.isDir(e.mode)) {
              return 54;
            }
            try {
              var t = FS.lookupNode(e, r);
              return 20;
            } catch {}
            return FS.nodePermissions(e, "wx");
          },
          mayDelete(e, r, t) {
            var n;
            try {
              n = FS.lookupNode(e, r);
            } catch (o) {
              return o.errno;
            }
            var a = FS.nodePermissions(e, "wx");
            if (a) {
              return a;
            }
            if (t) {
              if (!FS.isDir(n.mode)) {
                return 54;
              }
              if (FS.isRoot(n) || FS.getPath(n) === FS.cwd()) {
                return 10;
              }
            } else if (FS.isDir(n.mode)) {
              return 31;
            }
            return 0;
          },
          mayOpen(e, r) {
            if (e) {
              if (FS.isLink(e.mode)) {
                return 32;
              } else if (FS.isDir(e.mode) && (FS.flagsToPermissionString(r) !== "r" || r & 576)) {
                return 31;
              } else {
                return FS.nodePermissions(e, FS.flagsToPermissionString(r));
              }
            } else {
              return 44;
            }
          },
          checkOpExists(e, r) {
            if (!e) {
              throw new FS.ErrnoError(r);
            }
            return e;
          },
          MAX_OPEN_FDS: 4096,
          nextfd() {
            for (var e = 0; e <= FS.MAX_OPEN_FDS; e++) {
              if (!FS.streams[e]) {
                return e;
              }
            }
            throw new FS.ErrnoError(33);
          },
          getStreamChecked(e) {
            var r = FS.getStream(e);
            if (!r) {
              throw new FS.ErrnoError(8);
            }
            return r;
          },
          getStream: e => FS.streams[e],
          createStream(e, r = -1) {
            e = Object.assign(new FS.FSStream(), e);
            if (r == -1) {
              r = FS.nextfd();
            }
            e.fd = r;
            FS.streams[r] = e;
            return e;
          },
          closeStream(e) {
            FS.streams[e] = null;
          },
          dupStream(e, r = -1) {
            var t = FS.createStream(e, r);
            t.stream_ops?.dup?.(t);
            return t;
          },
          doSetAttr(e, r, t) {
            var n = e?.stream_ops.setattr;
            var a = n ? e : r;
            n ??= r.node_ops.setattr;
            FS.checkOpExists(n, 63);
            n(a, t);
          },
          chrdev_stream_ops: {
            open(e) {
              var r = FS.getDevice(e.node.rdev);
              e.stream_ops = r.stream_ops;
              e.stream_ops.open?.(e);
            },
            llseek() {
              throw new FS.ErrnoError(70);
            }
          },
          major: e => e >> 8,
          minor: e => e & 255,
          makedev: (e, r) => e << 8 | r,
          registerDevice(e, r) {
            FS.devices[e] = {
              stream_ops: r
            };
          },
          getDevice: e => FS.devices[e],
          getMounts(e) {
            var r = [];
            for (var t = [e]; t.length;) {
              var n = t.pop();
              r.push(n);
              t.push(...n.mounts);
            }
            return r;
          },
          syncfs(e, r) {
            if (typeof e == "function") {
              r = e;
              e = false;
            }
            FS.syncFSRequests++;
            if (FS.syncFSRequests > 1) {
              err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
            }
            var t = FS.getMounts(FS.root.mount);
            var n = 0;
            function a(c) {
              FS.syncFSRequests--;
              return r(c);
            }
            function o(c) {
              if (c) {
                if (o.errored) {
                  return undefined;
                } else {
                  o.errored = true;
                  return a(c);
                }
              }
              if (++n >= t.length) {
                a(null);
              }
            }
            for (var l of t) {
              if (l.type.syncfs) {
                l.type.syncfs(l, e, o);
              } else {
                o(null);
              }
            }
          },
          mount(e, r, t) {
            var n = t === "/";
            var a = !t;
            var o;
            if (n && FS.root) {
              throw new FS.ErrnoError(10);
            }
            if (!n && !a) {
              var l = FS.lookupPath(t, {
                follow_mount: false
              });
              t = l.path;
              o = l.node;
              if (FS.isMountpoint(o)) {
                throw new FS.ErrnoError(10);
              }
              if (!FS.isDir(o.mode)) {
                throw new FS.ErrnoError(54);
              }
            }
            var c = {
              type: e,
              opts: r,
              mountpoint: t,
              mounts: []
            };
            var _ = e.mount(c);
            _.mount = c;
            c.root = _;
            if (n) {
              FS.root = _;
            } else if (o) {
              o.mounted = c;
              if (o.mount) {
                o.mount.mounts.push(c);
              }
            }
            return _;
          },
          unmount(e) {
            var r = FS.lookupPath(e, {
              follow_mount: false
            });
            if (!FS.isMountpoint(r.node)) {
              throw new FS.ErrnoError(28);
            }
            var t = r.node;
            var n = t.mounted;
            var a = FS.getMounts(n);
            for (var [o, l] of Object.entries(FS.nameTable)) {
              while (l) {
                var c = l.name_next;
                if (a.includes(l.mount)) {
                  FS.destroyNode(l);
                }
                l = c;
              }
            }
            t.mounted = null;
            var _ = t.mount.mounts.indexOf(n);
            t.mount.mounts.splice(_, 1);
          },
          lookup(e, r) {
            return e.node_ops.lookup(e, r);
          },
          mknod(e, r, t) {
            var n = FS.lookupPath(e, {
              parent: true
            });
            var a = n.node;
            var o = PATH.basename(e);
            if (!o) {
              throw new FS.ErrnoError(28);
            }
            if (o === "." || o === "..") {
              throw new FS.ErrnoError(20);
            }
            var l = FS.mayCreate(a, o);
            if (l) {
              throw new FS.ErrnoError(l);
            }
            if (!a.node_ops.mknod) {
              throw new FS.ErrnoError(63);
            }
            return a.node_ops.mknod(a, o, r, t);
          },
          statfs(e) {
            return FS.statfsNode(FS.lookupPath(e, {
              follow: true
            }).node);
          },
          statfsStream(e) {
            return FS.statfsNode(e.node);
          },
          statfsNode(e) {
            var r = {
              bsize: 4096,
              frsize: 4096,
              blocks: 1000000,
              bfree: 500000,
              bavail: 500000,
              files: FS.nextInode,
              ffree: FS.nextInode - 1,
              fsid: 42,
              flags: 2,
              namelen: 255
            };
            if (e.node_ops.statfs) {
              Object.assign(r, e.node_ops.statfs(e.mount.opts.root));
            }
            return r;
          },
          create(e, r = 438) {
            r &= 4095;
            r |= 32768;
            return FS.mknod(e, r, 0);
          },
          mkdir(e, r = 511) {
            r &= 1023;
            r |= 16384;
            return FS.mknod(e, r, 0);
          },
          mkdirTree(e, r) {
            var t = e.split("/");
            var n = "";
            for (var a of t) {
              if (a) {
                if (n || PATH.isAbs(e)) {
                  n += "/";
                }
                n += a;
                try {
                  FS.mkdir(n, r);
                } catch (o) {
                  if (o.errno != 20) {
                    throw o;
                  }
                }
              }
            }
          },
          mkdev(e, r, t) {
            if (typeof t === "undefined") {
              t = r;
              r = 438;
            }
            r |= 8192;
            return FS.mknod(e, r, t);
          },
          symlink(e, r) {
            if (!PATH_FS.resolve(e)) {
              throw new FS.ErrnoError(44);
            }
            var t = FS.lookupPath(r, {
              parent: true
            });
            var n = t.node;
            if (!n) {
              throw new FS.ErrnoError(44);
            }
            var a = PATH.basename(r);
            var o = FS.mayCreate(n, a);
            if (o) {
              throw new FS.ErrnoError(o);
            }
            if (!n.node_ops.symlink) {
              throw new FS.ErrnoError(63);
            }
            return n.node_ops.symlink(n, a, e);
          },
          rename(e, r) {
            var t = PATH.dirname(e);
            var n = PATH.dirname(r);
            var a = PATH.basename(e);
            var o = PATH.basename(r);
            var l;
            var c;
            var _;
            l = FS.lookupPath(e, {
              parent: true
            });
            c = l.node;
            l = FS.lookupPath(r, {
              parent: true
            });
            _ = l.node;
            if (!c || !_) {
              throw new FS.ErrnoError(44);
            }
            if (c.mount !== _.mount) {
              throw new FS.ErrnoError(75);
            }
            var u = FS.lookupNode(c, a);
            var m = PATH_FS.relative(e, n);
            if (m.charAt(0) !== ".") {
              throw new FS.ErrnoError(28);
            }
            m = PATH_FS.relative(r, t);
            if (m.charAt(0) !== ".") {
              throw new FS.ErrnoError(55);
            }
            var f;
            try {
              f = FS.lookupNode(_, o);
            } catch {}
            if (u !== f) {
              var v = FS.isDir(u.mode);
              var g = FS.mayDelete(c, a, v);
              if (g) {
                throw new FS.ErrnoError(g);
              }
              g = f ? FS.mayDelete(_, o, v) : FS.mayCreate(_, o);
              if (g) {
                throw new FS.ErrnoError(g);
              }
              if (!c.node_ops.rename) {
                throw new FS.ErrnoError(63);
              }
              if (FS.isMountpoint(u) || f && FS.isMountpoint(f)) {
                throw new FS.ErrnoError(10);
              }
              if (_ !== c && (g = FS.nodePermissions(c, "w"), g)) {
                throw new FS.ErrnoError(g);
              }
              FS.hashRemoveNode(u);
              try {
                c.node_ops.rename(u, _, o);
                u.parent = _;
              } catch (h) {
                throw h;
              } finally {
                FS.hashAddNode(u);
              }
            }
          },
          rmdir(e) {
            var r = FS.lookupPath(e, {
              parent: true
            });
            var t = r.node;
            var n = PATH.basename(e);
            var a = FS.lookupNode(t, n);
            var o = FS.mayDelete(t, n, true);
            if (o) {
              throw new FS.ErrnoError(o);
            }
            if (!t.node_ops.rmdir) {
              throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(a)) {
              throw new FS.ErrnoError(10);
            }
            t.node_ops.rmdir(t, n);
            FS.destroyNode(a);
          },
          readdir(e) {
            var r = FS.lookupPath(e, {
              follow: true
            });
            var t = r.node;
            var n = FS.checkOpExists(t.node_ops.readdir, 54);
            return n(t);
          },
          unlink(e) {
            var r = FS.lookupPath(e, {
              parent: true
            });
            var t = r.node;
            if (!t) {
              throw new FS.ErrnoError(44);
            }
            var n = PATH.basename(e);
            var a = FS.lookupNode(t, n);
            var o = FS.mayDelete(t, n, false);
            if (o) {
              throw new FS.ErrnoError(o);
            }
            if (!t.node_ops.unlink) {
              throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(a)) {
              throw new FS.ErrnoError(10);
            }
            t.node_ops.unlink(t, n);
            FS.destroyNode(a);
          },
          readlink(e) {
            var r = FS.lookupPath(e);
            var t = r.node;
            if (!t) {
              throw new FS.ErrnoError(44);
            }
            if (!t.node_ops.readlink) {
              throw new FS.ErrnoError(28);
            }
            return t.node_ops.readlink(t);
          },
          stat(e, r) {
            var t = FS.lookupPath(e, {
              follow: !r
            });
            var n = t.node;
            var a = FS.checkOpExists(n.node_ops.getattr, 63);
            return a(n);
          },
          fstat(e) {
            var r = FS.getStreamChecked(e);
            var t = r.node;
            var n = r.stream_ops.getattr;
            var a = n ? r : t;
            n ??= t.node_ops.getattr;
            FS.checkOpExists(n, 63);
            return n(a);
          },
          lstat(e) {
            return FS.stat(e, true);
          },
          doChmod(e, r, t, n) {
            FS.doSetAttr(e, r, {
              mode: t & 4095 | r.mode & -4096,
              ctime: Date.now(),
              dontFollow: n
            });
          },
          chmod(e, r, t) {
            var n;
            if (typeof e == "string") {
              var a = FS.lookupPath(e, {
                follow: !t
              });
              n = a.node;
            } else {
              n = e;
            }
            FS.doChmod(null, n, r, t);
          },
          lchmod(e, r) {
            FS.chmod(e, r, true);
          },
          fchmod(e, r) {
            var t = FS.getStreamChecked(e);
            FS.doChmod(t, t.node, r, false);
          },
          doChown(e, r, t) {
            FS.doSetAttr(e, r, {
              timestamp: Date.now(),
              dontFollow: t
            });
          },
          chown(e, r, t, n) {
            var a;
            if (typeof e == "string") {
              var o = FS.lookupPath(e, {
                follow: !n
              });
              a = o.node;
            } else {
              a = e;
            }
            FS.doChown(null, a, n);
          },
          lchown(e, r, t) {
            FS.chown(e, r, t, true);
          },
          fchown(e, r, t) {
            var n = FS.getStreamChecked(e);
            FS.doChown(n, n.node, false);
          },
          doTruncate(e, r, t) {
            if (FS.isDir(r.mode)) {
              throw new FS.ErrnoError(31);
            }
            if (!FS.isFile(r.mode)) {
              throw new FS.ErrnoError(28);
            }
            var n = FS.nodePermissions(r, "w");
            if (n) {
              throw new FS.ErrnoError(n);
            }
            FS.doSetAttr(e, r, {
              size: t,
              timestamp: Date.now()
            });
          },
          truncate(e, r) {
            if (r < 0) {
              throw new FS.ErrnoError(28);
            }
            var t;
            if (typeof e == "string") {
              var n = FS.lookupPath(e, {
                follow: true
              });
              t = n.node;
            } else {
              t = e;
            }
            FS.doTruncate(null, t, r);
          },
          ftruncate(e, r) {
            var t = FS.getStreamChecked(e);
            if (r < 0 || (t.flags & 2097155) === 0) {
              throw new FS.ErrnoError(28);
            }
            FS.doTruncate(t, t.node, r);
          },
          utime(e, r, t) {
            var n = FS.lookupPath(e, {
              follow: true
            });
            var a = n.node;
            var o = FS.checkOpExists(a.node_ops.setattr, 63);
            o(a, {
              atime: r,
              mtime: t
            });
          },
          open(e, r, t = 438) {
            if (e === "") {
              throw new FS.ErrnoError(44);
            }
            r = typeof r == "string" ? FS_modeStringToFlags(r) : r;
            if (r & 64) {
              t = t & 4095 | 32768;
            } else {
              t = 0;
            }
            var n;
            var a;
            if (typeof e == "object") {
              n = e;
            } else {
              a = e.endsWith("/");
              var o = FS.lookupPath(e, {
                follow: !(r & 131072),
                noent_okay: true
              });
              n = o.node;
              e = o.path;
            }
            var l = false;
            if (r & 64) {
              if (n) {
                if (r & 128) {
                  throw new FS.ErrnoError(20);
                }
              } else {
                if (a) {
                  throw new FS.ErrnoError(31);
                }
                n = FS.mknod(e, t | 511, 0);
                l = true;
              }
            }
            if (!n) {
              throw new FS.ErrnoError(44);
            }
            if (FS.isChrdev(n.mode)) {
              r &= -513;
            }
            if (r & 65536 && !FS.isDir(n.mode)) {
              throw new FS.ErrnoError(54);
            }
            if (!l) {
              var c = FS.mayOpen(n, r);
              if (c) {
                throw new FS.ErrnoError(c);
              }
            }
            if (r & 512 && !l) {
              FS.truncate(n, 0);
            }
            r &= -131713;
            var _ = FS.createStream({
              node: n,
              path: FS.getPath(n),
              flags: r,
              seekable: true,
              position: 0,
              stream_ops: n.stream_ops,
              ungotten: [],
              error: false
            });
            if (_.stream_ops.open) {
              _.stream_ops.open(_);
            }
            if (l) {
              FS.chmod(n, t & 511);
            }
            if (Module.logReadFiles && !(r & 1)) {
              if (!(e in FS.readFiles)) {
                FS.readFiles[e] = 1;
              }
            }
            return _;
          },
          close(e) {
            if (FS.isClosed(e)) {
              throw new FS.ErrnoError(8);
            }
            e.getdents &&= null;
            try {
              if (e.stream_ops.close) {
                e.stream_ops.close(e);
              }
            } catch (r) {
              throw r;
            } finally {
              FS.closeStream(e.fd);
            }
            e.fd = null;
          },
          isClosed(e) {
            return e.fd === null;
          },
          llseek(e, r, t) {
            if (FS.isClosed(e)) {
              throw new FS.ErrnoError(8);
            }
            if (!e.seekable || !e.stream_ops.llseek) {
              throw new FS.ErrnoError(70);
            }
            if (t != 0 && t != 1 && t != 2) {
              throw new FS.ErrnoError(28);
            }
            e.position = e.stream_ops.llseek(e, r, t);
            e.ungotten = [];
            return e.position;
          },
          read(e, r, t, n, a) {
            if (n < 0 || a < 0) {
              throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(e)) {
              throw new FS.ErrnoError(8);
            }
            if ((e.flags & 2097155) === 1) {
              throw new FS.ErrnoError(8);
            }
            if (FS.isDir(e.node.mode)) {
              throw new FS.ErrnoError(31);
            }
            if (!e.stream_ops.read) {
              throw new FS.ErrnoError(28);
            }
            var o = typeof a !== "undefined";
            if (!o) {
              a = e.position;
            } else if (!e.seekable) {
              throw new FS.ErrnoError(70);
            }
            var l = e.stream_ops.read(e, r, t, n, a);
            if (!o) {
              e.position += l;
            }
            return l;
          },
          write(e, r, t, n, a, o) {
            if (n < 0 || a < 0) {
              throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(e)) {
              throw new FS.ErrnoError(8);
            }
            if ((e.flags & 2097155) === 0) {
              throw new FS.ErrnoError(8);
            }
            if (FS.isDir(e.node.mode)) {
              throw new FS.ErrnoError(31);
            }
            if (!e.stream_ops.write) {
              throw new FS.ErrnoError(28);
            }
            if (e.seekable && e.flags & 1024) {
              FS.llseek(e, 0, 2);
            }
            var l = typeof a !== "undefined";
            if (!l) {
              a = e.position;
            } else if (!e.seekable) {
              throw new FS.ErrnoError(70);
            }
            var c = e.stream_ops.write(e, r, t, n, a, o);
            if (!l) {
              e.position += c;
            }
            return c;
          },
          mmap(e, r, t, n, a) {
            if ((n & 2) !== 0 && (a & 2) === 0 && (e.flags & 2097155) !== 2) {
              throw new FS.ErrnoError(2);
            }
            if ((e.flags & 2097155) === 1) {
              throw new FS.ErrnoError(2);
            }
            if (!e.stream_ops.mmap) {
              throw new FS.ErrnoError(43);
            }
            if (!r) {
              throw new FS.ErrnoError(28);
            }
            return e.stream_ops.mmap(e, r, t, n, a);
          },
          msync(e, r, t, n, a) {
            if (e.stream_ops.msync) {
              return e.stream_ops.msync(e, r, t, n, a);
            } else {
              return 0;
            }
          },
          ioctl(e, r, t) {
            if (!e.stream_ops.ioctl) {
              throw new FS.ErrnoError(59);
            }
            return e.stream_ops.ioctl(e, r, t);
          },
          readFile(e, r = {}) {
            r.flags = r.flags || 0;
            r.encoding = r.encoding || "binary";
            if (r.encoding !== "utf8" && r.encoding !== "binary") {
              abort(`Invalid encoding type "${r.encoding}"`);
            }
            var t = FS.open(e, r.flags);
            var n = FS.stat(e);
            var a = n.size;
            var o = new Uint8Array(a);
            FS.read(t, o, 0, a, 0);
            if (r.encoding === "utf8") {
              o = UTF8ArrayToString(o);
            }
            FS.close(t);
            return o;
          },
          writeFile(e, r, t = {}) {
            t.flags = t.flags || 577;
            var n = FS.open(e, t.flags, t.mode);
            if (typeof r == "string") {
              r = new Uint8Array(intArrayFromString(r, true));
            }
            if (ArrayBuffer.isView(r)) {
              FS.write(n, r, 0, r.byteLength, undefined, t.canOwn);
            } else {
              abort("Unsupported data type");
            }
            FS.close(n);
          },
          cwd: () => FS.currentPath,
          chdir(e) {
            var r = FS.lookupPath(e, {
              follow: true
            });
            if (r.node === null) {
              throw new FS.ErrnoError(44);
            }
            if (!FS.isDir(r.node.mode)) {
              throw new FS.ErrnoError(54);
            }
            var t = FS.nodePermissions(r.node, "x");
            if (t) {
              throw new FS.ErrnoError(t);
            }
            FS.currentPath = r.path;
          },
          createDefaultDirectories() {
            FS.mkdir("/tmp");
            FS.mkdir("/home");
            FS.mkdir("/home/web_user");
          },
          createDefaultDevices() {
            FS.mkdir("/dev");
            FS.registerDevice(FS.makedev(1, 3), {
              read: () => 0,
              write: (n, a, o, l, c) => l,
              llseek: () => 0
            });
            FS.mkdev("/dev/null", FS.makedev(1, 3));
            TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
            TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
            FS.mkdev("/dev/tty", FS.makedev(5, 0));
            FS.mkdev("/dev/tty1", FS.makedev(6, 0));
            var e = new Uint8Array(1024);
            var r = 0;
            var t = () => {
              if (r === 0) {
                randomFill(e);
                r = e.byteLength;
              }
              return e[--r];
            };
            FS.createDevice("/dev", "random", t);
            FS.createDevice("/dev", "urandom", t);
            FS.mkdir("/dev/shm");
            FS.mkdir("/dev/shm/tmp");
          },
          createSpecialDirectories() {
            FS.mkdir("/proc");
            var e = FS.mkdir("/proc/self");
            FS.mkdir("/proc/self/fd");
            FS.mount({
              mount() {
                var r = FS.createNode(e, "fd", 16895, 73);
                r.stream_ops = {
                  llseek: MEMFS.stream_ops.llseek
                };
                r.node_ops = {
                  lookup(t, n) {
                    var a = +n;
                    var o = FS.getStreamChecked(a);
                    var l = {
                      parent: null,
                      mount: {
                        mountpoint: "fake"
                      },
                      node_ops: {
                        readlink: () => o.path
                      },
                      id: a + 1
                    };
                    l.parent = l;
                    return l;
                  },
                  readdir() {
                    return Array.from(FS.streams.entries()).filter(([t, n]) => n).map(([t, n]) => t.toString());
                  }
                };
                return r;
              }
            }, {}, "/proc/self/fd");
          },
          createStandardStreams(e, r, t) {
            if (e) {
              FS.createDevice("/dev", "stdin", e);
            } else {
              FS.symlink("/dev/tty", "/dev/stdin");
            }
            if (r) {
              FS.createDevice("/dev", "stdout", null, r);
            } else {
              FS.symlink("/dev/tty", "/dev/stdout");
            }
            if (t) {
              FS.createDevice("/dev", "stderr", null, t);
            } else {
              FS.symlink("/dev/tty1", "/dev/stderr");
            }
            var n = FS.open("/dev/stdin", 0);
            var a = FS.open("/dev/stdout", 1);
            var o = FS.open("/dev/stderr", 1);
          },
          staticInit() {
            FS.nameTable = new Array(4096);
            FS.mount(MEMFS, {}, "/");
            FS.createDefaultDirectories();
            FS.createDefaultDevices();
            FS.createSpecialDirectories();
            FS.filesystems = {
              MEMFS,
              IDBFS
            };
          },
          init(e, r, t) {
            FS.initialized = true;
            e ??= Module.stdin;
            r ??= Module.stdout;
            t ??= Module.stderr;
            FS.createStandardStreams(e, r, t);
          },
          quit() {
            FS.initialized = false;
            for (var e of FS.streams) {
              if (e) {
                FS.close(e);
              }
            }
          },
          findObject(e, r) {
            var t = FS.analyzePath(e, r);
            if (t.exists) {
              return t.object;
            } else {
              return null;
            }
          },
          analyzePath(e, r) {
            try {
              var t = FS.lookupPath(e, {
                follow: !r
              });
              e = t.path;
            } catch {}
            var n = {
              isRoot: false,
              exists: false,
              error: 0,
              name: null,
              path: null,
              object: null,
              parentExists: false,
              parentPath: null,
              parentObject: null
            };
            try {
              var t = FS.lookupPath(e, {
                parent: true
              });
              n.parentExists = true;
              n.parentPath = t.path;
              n.parentObject = t.node;
              n.name = PATH.basename(e);
              t = FS.lookupPath(e, {
                follow: !r
              });
              n.exists = true;
              n.path = t.path;
              n.object = t.node;
              n.name = t.node.name;
              n.isRoot = t.path === "/";
            } catch (a) {
              n.error = a.errno;
            }
            return n;
          },
          createPath(e, r, t, n) {
            e = typeof e == "string" ? e : FS.getPath(e);
            for (var a = r.split("/").reverse(); a.length;) {
              var o = a.pop();
              if (o) {
                var l = PATH.join2(e, o);
                try {
                  FS.mkdir(l);
                } catch (c) {
                  if (c.errno != 20) {
                    throw c;
                  }
                }
                e = l;
              }
            }
            return l;
          },
          createFile(e, r, t, n, a) {
            var o = PATH.join2(typeof e == "string" ? e : FS.getPath(e), r);
            var l = FS_getMode(n, a);
            return FS.create(o, l);
          },
          createDataFile(e, r, t, n, a, o) {
            var l = r;
            if (e) {
              e = typeof e == "string" ? e : FS.getPath(e);
              l = r ? PATH.join2(e, r) : e;
            }
            var c = FS_getMode(n, a);
            var _ = FS.create(l, c);
            if (t) {
              if (typeof t == "string") {
                var u = new Array(t.length);
                for (var m = 0, f = t.length; m < f; ++m) {
                  u[m] = t.charCodeAt(m);
                }
                t = u;
              }
              FS.chmod(_, c | 146);
              var v = FS.open(_, 577);
              FS.write(v, t, 0, t.length, 0, o);
              FS.close(v);
              FS.chmod(_, c);
            }
          },
          createDevice(e, r, t, n) {
            var a;
            var o = PATH.join2(typeof e == "string" ? e : FS.getPath(e), r);
            var l = FS_getMode(!!t, !!n);
            (a = FS.createDevice).major ?? (a.major = 64);
            var c = FS.makedev(FS.createDevice.major++, 0);
            FS.registerDevice(c, {
              open(_) {
                _.seekable = false;
              },
              close(_) {
                if (n?.buffer?.length) {
                  n(10);
                }
              },
              read(_, u, m, f, v) {
                var g = 0;
                for (var h = 0; h < f; h++) {
                  var p;
                  try {
                    p = t();
                  } catch {
                    throw new FS.ErrnoError(29);
                  }
                  if (p === undefined && g === 0) {
                    throw new FS.ErrnoError(6);
                  }
                  if (p == null) {
                    break;
                  }
                  g++;
                  u[m + h] = p;
                }
                if (g) {
                  _.node.atime = Date.now();
                }
                return g;
              },
              write(_, u, m, f, v) {
                for (var g = 0; g < f; g++) {
                  try {
                    n(u[m + g]);
                  } catch {
                    throw new FS.ErrnoError(29);
                  }
                }
                if (f) {
                  _.node.mtime = _.node.ctime = Date.now();
                }
                return g;
              }
            });
            return FS.mkdev(o, l, c);
          },
          forceLoadFile(e) {
            if (e.isDevice || e.isFolder || e.link || e.contents) {
              return true;
            }
            if (globalThis.XMLHttpRequest) {
              abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
            } else {
              try {
                e.contents = readBinary(e.url);
              } catch {
                throw new FS.ErrnoError(29);
              }
            }
          },
          createLazyFile(e, r, t, n, a) {
            class o {
              constructor() {
                this.lengthKnown = false;
                this.chunks = [];
              }
              get(v) {
                if (!(v > this.length - 1) && !(v < 0)) {
                  var g = v % this.chunkSize;
                  var h = v / this.chunkSize | 0;
                  return this.getter(h)[g];
                }
              }
              setDataGetter(v) {
                this.getter = v;
              }
              cacheLength() {
                var v = new XMLHttpRequest();
                v.open("HEAD", t, false);
                v.send(null);
                if ((!(v.status >= 200) || !(v.status < 300)) && v.status !== 304) {
                  abort("Couldn't load " + t + ". Status: " + v.status);
                }
                var g = Number(v.getResponseHeader("Content-length"));
                var h;
                var p = (h = v.getResponseHeader("Accept-Ranges")) && h === "bytes";
                var b = (h = v.getResponseHeader("Content-Encoding")) && h === "gzip";
                var S = 1048576;
                if (!p) {
                  S = g;
                }
                var w = (k, G) => {
                  if (k > G) {
                    abort("invalid range (" + k + ", " + G + ") or no bytes requested!");
                  }
                  if (G > g - 1) {
                    abort("only " + g + " bytes available! programmer error!");
                  }
                  var D = new XMLHttpRequest();
                  D.open("GET", t, false);
                  if (g !== S) {
                    D.setRequestHeader("Range", "bytes=" + k + "-" + G);
                  }
                  D.responseType = "arraybuffer";
                  if (D.overrideMimeType) {
                    D.overrideMimeType("text/plain; charset=x-user-defined");
                  }
                  D.send(null);
                  if ((!(D.status >= 200) || !(D.status < 300)) && D.status !== 304) {
                    abort("Couldn't load " + t + ". Status: " + D.status);
                  }
                  if (D.response !== undefined) {
                    return new Uint8Array(D.response || []);
                  } else {
                    return intArrayFromString(D.responseText || "", true);
                  }
                };
                var A = this;
                A.setDataGetter(k => {
                  var G = k * S;
                  var D = (k + 1) * S - 1;
                  D = Math.min(D, g - 1);
                  if (typeof A.chunks[k] === "undefined") {
                    A.chunks[k] = w(G, D);
                  }
                  if (typeof A.chunks[k] === "undefined") {
                    abort("doXHR failed!");
                  }
                  return A.chunks[k];
                });
                if (b || !g) {
                  S = g = 1;
                  g = this.getter(0).length;
                  S = g;
                  out("LazyFiles on gzip forces download of the whole file when length is accessed");
                }
                this._length = g;
                this._chunkSize = S;
                this.lengthKnown = true;
              }
              get length() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
              get chunkSize() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
            if (globalThis.XMLHttpRequest) {
              if (!ENVIRONMENT_IS_WORKER) {
                abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
              }
              var l = new o();
              var c = {
                isDevice: false,
                contents: l
              };
            } else {
              var c = {
                isDevice: false,
                url: t
              };
            }
            var _ = FS.createFile(e, r, c, n, a);
            if (c.contents) {
              _.contents = c.contents;
            } else if (c.url) {
              _.contents = null;
              _.url = c.url;
            }
            Object.defineProperties(_, {
              usedBytes: {
                get: function () {
                  return this.contents.length;
                }
              }
            });
            var u = {};
            for (let [f, v] of Object.entries(_.stream_ops)) {
              u[f] = (...g) => {
                FS.forceLoadFile(_);
                return v(...g);
              };
            }
            function m(f, v, g, h, p) {
              var b = f.node.contents;
              if (p >= b.length) {
                return 0;
              }
              var S = Math.min(b.length - p, h);
              if (b.slice) {
                for (var w = 0; w < S; w++) {
                  v[g + w] = b[p + w];
                }
              } else {
                for (var w = 0; w < S; w++) {
                  v[g + w] = b.get(p + w);
                }
              }
              return S;
            }
            u.read = (f, v, g, h, p) => {
              FS.forceLoadFile(_);
              return m(f, v, g, h, p);
            };
            u.mmap = (f, v, g, h, p) => {
              FS.forceLoadFile(_);
              var b = mmapAlloc(v);
              if (!b) {
                throw new FS.ErrnoError(48);
              }
              m(f, HEAP8, b, v, g);
              return {
                ptr: b,
                allocated: true
              };
            };
            _.stream_ops = u;
            return _;
          }
        };
        var findLibraryFS = (e, r) => {
          if (runtimeInitialized) {
            if (PATH.isAbs(e)) {
              try {
                FS.lookupPath(e);
                return e;
              } catch {
                return;
              }
            }
            var t = (r?.paths || []).map(n => replaceORIGIN(r?.parentLibPath, n));
            return withStackSave(() => {
              var n = 512;
              var a = stackAlloc(n);
              var o = stringToUTF8OnStack(t.join(":"));
              var l = stringToUTF8OnStack(e);
              var c = __emscripten_find_dylib(a, o, l, n);
              if (c) {
                return UTF8ToString(c);
              } else {
                return undefined;
              }
            });
          }
        };
        function loadDynamicLibrary(e, r = {
          global: true,
          nodelete: true
        }, t, n) {
          var a = LDSO.loadedLibsByName[e];
          if (a) {
            if (r.global) {
              if (!a.global) {
                a.global = true;
                mergeLibSymbols(a.exports, e);
              }
            } else if (t) {
              Object.assign(t, a.exports);
            }
            if (r.nodelete && a.refcount !== Infinity) {
              a.refcount = Infinity;
            }
            a.refcount++;
            if (n) {
              LDSO.loadedLibsByHandle[n] = a;
            }
            if (r.loadAsync) {
              return Promise.resolve(true);
            } else {
              return true;
            }
          }
          a = newDSO(e, n, "loading");
          a.refcount = r.nodelete ? Infinity : 1;
          a.global = r.global;
          function o() {
            if (n) {
              var _ = HEAPU32[n + 28 >> 2];
              var u = HEAPU32[n + 32 >> 2];
              if (_ && u) {
                var m = HEAP8.slice(_, _ + u);
                if (r.loadAsync) {
                  return Promise.resolve(m);
                } else {
                  return m;
                }
              }
            }
            var f = findLibraryFS(e, r.rpath);
            if (f) {
              var m = FS.readFile(f, {
                encoding: "binary"
              });
              if (r.loadAsync) {
                return Promise.resolve(m);
              } else {
                return m;
              }
            }
            var v = locateFile(e);
            if (r.loadAsync) {
              return asyncLoad(v);
            }
            if (!readBinary) {
              throw new Error(`${v}: file not found, and synchronous loading of external files is not available`);
            }
            return readBinary(v);
          }
          function l() {
            var _ = preloadedWasm[e];
            if (_) {
              if (r.loadAsync) {
                return Promise.resolve(_);
              } else {
                return _;
              }
            } else if (r.loadAsync) {
              return o().then(u => loadWebAssemblyModule(u, r, e, t, n));
            } else {
              return loadWebAssemblyModule(o(), r, e, t, n);
            }
          }
          function c(_) {
            if (a.global) {
              mergeLibSymbols(_, e);
            } else if (t) {
              Object.assign(t, _);
            }
            a.exports = _;
          }
          if (r.loadAsync) {
            return l().then(_ => {
              c(_);
              return true;
            });
          } else {
            c(l());
            return true;
          }
        }
        var reportUndefinedSymbols = () => {
          for (var [e, r] of Object.entries(GOT)) {
            if (r.value == -1) {
              var t = resolveGlobalSymbol(e, true).sym;
              if (!t && !r.required) {
                r.value = 0;
                continue;
              }
              if (typeof t == "function") {
                r.value = addFunction(t, t.sig);
              } else if (typeof t == "number") {
                r.value = t;
              } else if (typeof t.value == "number") {
                r.value = t;
              } else {
                throw new Error(`bad export type for '${e}': ${typeof t} (${t})`);
              }
            }
          }
        };
        var loadDylibs = async () => {
          if (!dynamicLibraries.length) {
            reportUndefinedSymbols();
            return;
          }
          addRunDependency("loadDylibs");
          for (var e of dynamicLibraries) {
            await loadDynamicLibrary(e, {
              loadAsync: true,
              global: true,
              nodelete: true,
              allowUndefined: true
            });
          }
          reportUndefinedSymbols();
          removeRunDependency("loadDylibs");
        };
        var noExitRuntime = true;
        function setValue(e, r, t = "i8") {
          if (t.endsWith("*")) {
            t = "*";
          }
          switch (t) {
            case "i1":
              HEAP8[e] = r;
              break;
            case "i8":
              HEAP8[e] = r;
              break;
            case "i16":
              HEAP16[e >> 1] = r;
              break;
            case "i32":
              HEAP32[e >> 2] = r;
              break;
            case "i64":
              HEAP64[e >> 3] = BigInt(r);
              break;
            case "float":
              HEAPF32[e >> 2] = r;
              break;
            case "double":
              HEAPF64[e >> 3] = r;
              break;
            case "*":
              HEAPU32[e >> 2] = r;
              break;
            default:
              abort(`invalid type for setValue: ${t}`);
          }
        }
        var ___assert_fail = (e, r, t, n) => abort(`Assertion failed: ${UTF8ToString(e)}, at: ${[r ? UTF8ToString(r) : "unknown filename", t, n ? UTF8ToString(n) : "unknown function"]}`);
        ___assert_fail.sig = "vppip";
        var ___call_sighandler = (e, r) => getWasmTableEntry(e)(r);
        ___call_sighandler.sig = "vpi";
        var SOCKFS = {
          websocketArgs: {},
          callbacks: {},
          on(e, r) {
            SOCKFS.callbacks[e] = r;
          },
          emit(e, r) {
            SOCKFS.callbacks[e]?.(r);
          },
          mount(e) {
            SOCKFS.websocketArgs = Module.websocket || {};
            (Module.websocket ??= {}).on = SOCKFS.on;
            return FS.createNode(null, "/", 16895, 0);
          },
          createSocket(e, r, t) {
            if (e != 2) {
              throw new FS.ErrnoError(5);
            }
            r &= -526337;
            if (r != 1 && r != 2) {
              throw new FS.ErrnoError(28);
            }
            var n = r == 1;
            if (n && t && t != 6) {
              throw new FS.ErrnoError(66);
            }
            var a = {
              family: e,
              type: r,
              protocol: t,
              server: null,
              error: null,
              peers: {},
              pending: [],
              recv_queue: [],
              sock_ops: SOCKFS.websocket_sock_ops
            };
            var o = SOCKFS.nextname();
            var l = FS.createNode(SOCKFS.root, o, 49152, 0);
            l.sock = a;
            var c = FS.createStream({
              path: o,
              node: l,
              flags: 2,
              seekable: false,
              stream_ops: SOCKFS.stream_ops
            });
            a.stream = c;
            return a;
          },
          getSocket(e) {
            var r = FS.getStream(e);
            if (!r || !FS.isSocket(r.node.mode)) {
              return null;
            } else {
              return r.node.sock;
            }
          },
          stream_ops: {
            poll(e) {
              var r = e.node.sock;
              return r.sock_ops.poll(r);
            },
            ioctl(e, r, t) {
              var n = e.node.sock;
              return n.sock_ops.ioctl(n, r, t);
            },
            read(e, r, t, n, a) {
              var o = e.node.sock;
              var l = o.sock_ops.recvmsg(o, n);
              if (l) {
                r.set(l.buffer, t);
                return l.buffer.length;
              } else {
                return 0;
              }
            },
            write(e, r, t, n, a) {
              var o = e.node.sock;
              return o.sock_ops.sendmsg(o, r, t, n);
            },
            close(e) {
              var r = e.node.sock;
              r.sock_ops.close(r);
            }
          },
          nextname() {
            SOCKFS.nextname.current ||= 0;
            return `socket[${SOCKFS.nextname.current++}]`;
          },
          websocket_sock_ops: {
            createPeer(e, r, t) {
              var n;
              if (typeof r == "object") {
                n = r;
                r = null;
                t = null;
              }
              if (n) {
                if (n._socket) {
                  r = n._socket.remoteAddress;
                  t = n._socket.remotePort;
                } else {
                  var a = /ws[s]?:\/\/([^:]+):(\d+)/.exec(n.url);
                  if (!a) {
                    throw new Error("WebSocket URL must be in the format ws(s)://address:port");
                  }
                  r = a[1];
                  t = parseInt(a[2], 10);
                }
              } else {
                try {
                  var o = "ws://".replace("#", "//");
                  var l = "binary";
                  var c = undefined;
                  if (SOCKFS.websocketArgs.url) {
                    o = SOCKFS.websocketArgs.url;
                  }
                  if (SOCKFS.websocketArgs.subprotocol) {
                    l = SOCKFS.websocketArgs.subprotocol;
                  } else if (SOCKFS.websocketArgs.subprotocol === null) {
                    l = "null";
                  }
                  if (o === "ws://" || o === "wss://") {
                    var _ = r.split("/");
                    o = o + _[0] + ":" + t + "/" + _.slice(1).join("/");
                  }
                  if (l !== "null") {
                    l = l.replace(/^ +| +$/g, "").split(/ *, */);
                    c = l;
                  }
                  var u;
                  u = WebSocket;
                  n = new u(o, c);
                  n.binaryType = "arraybuffer";
                } catch {
                  throw new FS.ErrnoError(23);
                }
              }
              var m = {
                addr: r,
                port: t,
                socket: n,
                msg_send_queue: []
              };
              SOCKFS.websocket_sock_ops.addPeer(e, m);
              SOCKFS.websocket_sock_ops.handlePeerEvents(e, m);
              if (e.type === 2 && typeof e.sport !== "undefined") {
                m.msg_send_queue.push(new Uint8Array([255, 255, 255, 255, 112, 111, 114, 116, (e.sport & 65280) >> 8, e.sport & 255]));
              }
              return m;
            },
            getPeer(e, r, t) {
              return e.peers[r + ":" + t];
            },
            addPeer(e, r) {
              e.peers[r.addr + ":" + r.port] = r;
            },
            removePeer(e, r) {
              delete e.peers[r.addr + ":" + r.port];
            },
            handlePeerEvents(e, r) {
              var t = true;
              var n = function () {
                e.connecting = false;
                SOCKFS.emit("open", e.stream.fd);
                try {
                  for (var o = r.msg_send_queue.shift(); o;) {
                    r.socket.send(o);
                    o = r.msg_send_queue.shift();
                  }
                } catch {
                  r.socket.close();
                }
              };
              function a(o) {
                if (typeof o == "string") {
                  var l = new TextEncoder();
                  o = l.encode(o);
                } else {
                  if (o.byteLength == 0) {
                    return;
                  }
                  o = new Uint8Array(o);
                }
                var c = t;
                t = false;
                if (c && o.length === 10 && o[0] === 255 && o[1] === 255 && o[2] === 255 && o[3] === 255 && o[4] === 112 && o[5] === 111 && o[6] === 114 && o[7] === 116) {
                  var _ = o[8] << 8 | o[9];
                  SOCKFS.websocket_sock_ops.removePeer(e, r);
                  r.port = _;
                  SOCKFS.websocket_sock_ops.addPeer(e, r);
                  return;
                }
                e.recv_queue.push({
                  addr: r.addr,
                  port: r.port,
                  data: o
                });
                SOCKFS.emit("message", e.stream.fd);
              }
              if (ENVIRONMENT_IS_NODE) {
                r.socket.on("open", n);
                r.socket.on("message", function (o, l) {
                  if (l) {
                    a(new Uint8Array(o).buffer);
                  }
                });
                r.socket.on("close", function () {
                  SOCKFS.emit("close", e.stream.fd);
                });
                r.socket.on("error", function (o) {
                  e.error = 14;
                  SOCKFS.emit("error", [e.stream.fd, e.error, "ECONNREFUSED: Connection refused"]);
                });
              } else {
                r.socket.onopen = n;
                r.socket.onclose = function () {
                  SOCKFS.emit("close", e.stream.fd);
                };
                r.socket.onmessage = function (l) {
                  a(l.data);
                };
                r.socket.onerror = function (o) {
                  e.error = 14;
                  SOCKFS.emit("error", [e.stream.fd, e.error, "ECONNREFUSED: Connection refused"]);
                };
              }
            },
            poll(e) {
              if (e.type === 1 && e.server) {
                if (e.pending.length) {
                  return 65;
                } else {
                  return 0;
                }
              }
              var r = 0;
              var t = e.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport) : null;
              if (e.recv_queue.length || !t || t && t.socket.readyState === t.socket.CLOSING || t && t.socket.readyState === t.socket.CLOSED) {
                r |= 65;
              }
              if (!t || t && t.socket.readyState === t.socket.OPEN) {
                r |= 4;
              }
              if (t && t.socket.readyState === t.socket.CLOSING || t && t.socket.readyState === t.socket.CLOSED) {
                if (e.connecting) {
                  r |= 4;
                } else {
                  r |= 16;
                }
              }
              return r;
            },
            ioctl(e, r, t) {
              switch (r) {
                case 21531:
                  var n = 0;
                  if (e.recv_queue.length) {
                    n = e.recv_queue[0].data.length;
                  }
                  HEAP32[t >> 2] = n;
                  return 0;
                case 21537:
                  var a = HEAP32[t >> 2];
                  if (a) {
                    e.stream.flags |= 2048;
                  } else {
                    e.stream.flags &= -2049;
                  }
                  return 0;
                default:
                  return 28;
              }
            },
            close(e) {
              if (e.server) {
                try {
                  e.server.close();
                } catch {}
                e.server = null;
              }
              for (var r of Object.values(e.peers)) {
                try {
                  r.socket.close();
                } catch {}
                SOCKFS.websocket_sock_ops.removePeer(e, r);
              }
              return 0;
            },
            bind(e, r, t) {
              if (typeof e.saddr !== "undefined" || typeof e.sport !== "undefined") {
                throw new FS.ErrnoError(28);
              }
              e.saddr = r;
              e.sport = t;
              if (e.type === 2) {
                if (e.server) {
                  e.server.close();
                  e.server = null;
                }
                try {
                  e.sock_ops.listen(e, 0);
                } catch (n) {
                  if (n.name !== "ErrnoError" || n.errno !== 138) {
                    throw n;
                  }
                }
              }
            },
            connect(e, r, t) {
              if (e.server) {
                throw new FS.ErrnoError(138);
              }
              if (typeof e.daddr !== "undefined" && typeof e.dport !== "undefined") {
                var n = SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport);
                if (n) {
                  throw n.socket.readyState === n.socket.CONNECTING ? new FS.ErrnoError(7) : new FS.ErrnoError(30);
                }
              }
              var a = SOCKFS.websocket_sock_ops.createPeer(e, r, t);
              e.daddr = a.addr;
              e.dport = a.port;
              e.connecting = true;
            },
            listen(e, r) {
              if (!ENVIRONMENT_IS_NODE) {
                throw new FS.ErrnoError(138);
              }
            },
            accept(e) {
              if (!e.server || !e.pending.length) {
                throw new FS.ErrnoError(28);
              }
              var r = e.pending.shift();
              r.stream.flags = e.stream.flags;
              return r;
            },
            getname(e, r) {
              var t;
              var n;
              if (r) {
                if (e.daddr === undefined || e.dport === undefined) {
                  throw new FS.ErrnoError(53);
                }
                t = e.daddr;
                n = e.dport;
              } else {
                t = e.saddr || 0;
                n = e.sport || 0;
              }
              return {
                addr: t,
                port: n
              };
            },
            sendmsg(e, r, t, n, a, o) {
              if (e.type === 2) {
                if (a === undefined || o === undefined) {
                  a = e.daddr;
                  o = e.dport;
                }
                if (a === undefined || o === undefined) {
                  throw new FS.ErrnoError(17);
                }
              } else {
                a = e.daddr;
                o = e.dport;
              }
              var l = SOCKFS.websocket_sock_ops.getPeer(e, a, o);
              if (e.type === 1 && (!l || l.socket.readyState === l.socket.CLOSING || l.socket.readyState === l.socket.CLOSED)) {
                throw new FS.ErrnoError(53);
              }
              if (ArrayBuffer.isView(r)) {
                t += r.byteOffset;
                r = r.buffer;
              }
              var c = r.slice(t, t + n);
              if (!l || l.socket.readyState !== l.socket.OPEN) {
                if (e.type === 2 && (!l || l.socket.readyState === l.socket.CLOSING || l.socket.readyState === l.socket.CLOSED)) {
                  l = SOCKFS.websocket_sock_ops.createPeer(e, a, o);
                }
                l.msg_send_queue.push(c);
                return n;
              }
              try {
                l.socket.send(c);
                return n;
              } catch {
                throw new FS.ErrnoError(28);
              }
            },
            recvmsg(e, r) {
              if (e.type === 1 && e.server) {
                throw new FS.ErrnoError(53);
              }
              var t = e.recv_queue.shift();
              if (!t) {
                if (e.type === 1) {
                  var n = SOCKFS.websocket_sock_ops.getPeer(e, e.daddr, e.dport);
                  if (!n) {
                    throw new FS.ErrnoError(53);
                  }
                  if (n.socket.readyState === n.socket.CLOSING || n.socket.readyState === n.socket.CLOSED) {
                    return null;
                  }
                  throw new FS.ErrnoError(6);
                }
                throw new FS.ErrnoError(6);
              }
              var a = t.data.byteLength || t.data.length;
              var o = t.data.byteOffset || 0;
              var l = t.data.buffer || t.data;
              var c = Math.min(r, a);
              var _ = {
                buffer: new Uint8Array(l, o, c),
                addr: t.addr,
                port: t.port
              };
              if (e.type === 1 && c < a) {
                var u = a - c;
                t.data = new Uint8Array(l, o + c, u);
                e.recv_queue.unshift(t);
              }
              return _;
            }
          }
        };
        var getSocketFromFD = e => {
          var r = SOCKFS.getSocket(e);
          if (!r) {
            throw new FS.ErrnoError(8);
          }
          return r;
        };
        var inetPton4 = e => {
          var r = e.split(".");
          for (var t = 0; t < 4; t++) {
            var n = Number(r[t]);
            if (isNaN(n)) {
              return null;
            }
            r[t] = n;
          }
          return (r[0] | r[1] << 8 | r[2] << 16 | r[3] << 24) >>> 0;
        };
        var inetPton6 = e => {
          var r;
          var t;
          var n;
          var a;
          var o;
          var l = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
          var c = [];
          if (!l.test(e)) {
            return null;
          }
          if (e === "::") {
            return [0, 0, 0, 0, 0, 0, 0, 0];
          }
          if (e.startsWith("::")) {
            e = e.replace("::", "Z:");
          } else {
            e = e.replace("::", ":Z:");
          }
          if (e.indexOf(".") > 0) {
            e = e.replace(new RegExp("[.]", "g"), ":");
            r = e.split(":");
            r[r.length - 4] = Number(r[r.length - 4]) + Number(r[r.length - 3]) * 256;
            r[r.length - 3] = Number(r[r.length - 2]) + Number(r[r.length - 1]) * 256;
            r = r.slice(0, r.length - 2);
          } else {
            r = e.split(":");
          }
          n = 0;
          a = 0;
          t = 0;
          for (; t < r.length; t++) {
            if (typeof r[t] == "string") {
              if (r[t] === "Z") {
                for (a = 0; a < 8 - r.length + 1; a++) {
                  c[t + a] = 0;
                }
                n = a - 1;
              } else {
                c[t + n] = _htons(parseInt(r[t], 16));
              }
            } else {
              c[t + n] = r[t];
            }
          }
          return [c[1] << 16 | c[0], c[3] << 16 | c[2], c[5] << 16 | c[4], c[7] << 16 | c[6]];
        };
        var writeSockaddr = (e, r, t, n, a) => {
          switch (r) {
            case 2:
              t = inetPton4(t);
              zeroMemory(e, 16);
              if (a) {
                HEAP32[a >> 2] = 16;
              }
              HEAP16[e >> 1] = r;
              HEAP32[e + 4 >> 2] = t;
              HEAP16[e + 2 >> 1] = _htons(n);
              break;
            case 10:
              t = inetPton6(t);
              zeroMemory(e, 28);
              if (a) {
                HEAP32[a >> 2] = 28;
              }
              HEAP32[e >> 2] = r;
              HEAP32[e + 8 >> 2] = t[0];
              HEAP32[e + 12 >> 2] = t[1];
              HEAP32[e + 16 >> 2] = t[2];
              HEAP32[e + 20 >> 2] = t[3];
              HEAP16[e + 2 >> 1] = _htons(n);
              break;
            default:
              return 5;
          }
          return 0;
        };
        var DNS = {
          address_map: {
            id: 1,
            addrs: {},
            names: {}
          },
          lookup_name(e) {
            var r = inetPton4(e);
            if (r !== null || (r = inetPton6(e), r !== null)) {
              return e;
            }
            var t;
            if (DNS.address_map.addrs[e]) {
              t = DNS.address_map.addrs[e];
            } else {
              var n = DNS.address_map.id++;
              t = "172.29." + (n & 255) + "." + (n & 65280);
              DNS.address_map.names[t] = e;
              DNS.address_map.addrs[e] = t;
            }
            return t;
          },
          lookup_addr(e) {
            if (DNS.address_map.names[e]) {
              return DNS.address_map.names[e];
            } else {
              return null;
            }
          }
        };
        function ___syscall_accept4(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = l.sock_ops.accept(l);
            if (r) {
              var _ = writeSockaddr(r, c.family, DNS.lookup_name(c.daddr), c.dport, t);
            }
            return c.stream.fd;
          } catch (u) {
            if (typeof FS === "undefined" || u.name !== "ErrnoError") {
              throw u;
            }
            return -u.errno;
          }
        }
        ___syscall_accept4.sig = "iippiii";
        var inetNtop4 = e => (e & 255) + "." + (e >> 8 & 255) + "." + (e >> 16 & 255) + "." + (e >> 24 & 255);
        var inetNtop6 = e => {
          var r = "";
          var t = 0;
          var n = 0;
          var a = 0;
          var o = 0;
          var l = 0;
          var c = 0;
          var _ = [e[0] & 65535, e[0] >> 16, e[1] & 65535, e[1] >> 16, e[2] & 65535, e[2] >> 16, e[3] & 65535, e[3] >> 16];
          var u = true;
          var m = "";
          for (c = 0; c < 5; c++) {
            if (_[c] !== 0) {
              u = false;
              break;
            }
          }
          if (u) {
            m = inetNtop4(_[6] | _[7] << 16);
            if (_[5] === -1) {
              r = "::ffff:";
              r += m;
              return r;
            }
            if (_[5] === 0) {
              r = "::";
              if (m === "0.0.0.0") {
                m = "";
              }
              if (m === "0.0.0.1") {
                m = "1";
              }
              r += m;
              return r;
            }
          }
          for (t = 0; t < 8; t++) {
            if (_[t] === 0) {
              if (t - a > 1) {
                l = 0;
              }
              a = t;
              l++;
            }
            if (l > n) {
              n = l;
              o = t - n + 1;
            }
          }
          for (t = 0; t < 8; t++) {
            if (n > 1 && _[t] === 0 && t >= o && t < o + n) {
              if (t === o) {
                r += ":";
                if (o === 0) {
                  r += ":";
                }
              }
              continue;
            }
            r += Number(_ntohs(_[t] & 65535)).toString(16);
            r += t < 7 ? ":" : "";
          }
          return r;
        };
        var readSockaddr = (e, r) => {
          var t = HEAP16[e >> 1];
          var n = _ntohs(HEAPU16[e + 2 >> 1]);
          var a;
          switch (t) {
            case 2:
              if (r !== 16) {
                return {
                  errno: 28
                };
              }
              a = HEAP32[e + 4 >> 2];
              a = inetNtop4(a);
              break;
            case 10:
              if (r !== 28) {
                return {
                  errno: 28
                };
              }
              a = [HEAP32[e + 8 >> 2], HEAP32[e + 12 >> 2], HEAP32[e + 16 >> 2], HEAP32[e + 20 >> 2]];
              a = inetNtop6(a);
              break;
            default:
              return {
                errno: 5
              };
          }
          return {
            family: t,
            addr: a,
            port: n
          };
        };
        var getSocketAddress = (e, r) => {
          var t = readSockaddr(e, r);
          if (t.errno) {
            throw new FS.ErrnoError(t.errno);
          }
          t.addr = DNS.lookup_addr(t.addr) || t.addr;
          return t;
        };
        function ___syscall_bind(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = getSocketAddress(r, t);
            l.sock_ops.bind(l, c.addr, c.port);
            return 0;
          } catch (_) {
            if (typeof FS === "undefined" || _.name !== "ErrnoError") {
              throw _;
            }
            return -_.errno;
          }
        }
        ___syscall_bind.sig = "iippiii";
        var SYSCALLS = {
          calculateAt(e, r, t) {
            if (PATH.isAbs(r)) {
              return r;
            }
            var n;
            if (e === -100) {
              n = FS.cwd();
            } else {
              var a = SYSCALLS.getStreamFromFD(e);
              n = a.path;
            }
            if (r.length == 0) {
              if (!t) {
                throw new FS.ErrnoError(44);
              }
              return n;
            }
            return n + "/" + r;
          },
          writeStat(e, r) {
            HEAPU32[e >> 2] = r.dev;
            HEAPU32[e + 4 >> 2] = r.mode;
            HEAPU32[e + 8 >> 2] = r.nlink;
            HEAPU32[e + 12 >> 2] = r.uid;
            HEAPU32[e + 16 >> 2] = r.gid;
            HEAPU32[e + 20 >> 2] = r.rdev;
            HEAP64[e + 24 >> 3] = BigInt(r.size);
            HEAP32[e + 32 >> 2] = 4096;
            HEAP32[e + 36 >> 2] = r.blocks;
            var t = r.atime.getTime();
            var n = r.mtime.getTime();
            var a = r.ctime.getTime();
            HEAP64[e + 40 >> 3] = BigInt(Math.floor(t / 1000));
            HEAPU32[e + 48 >> 2] = t % 1000 * 1000 * 1000;
            HEAP64[e + 56 >> 3] = BigInt(Math.floor(n / 1000));
            HEAPU32[e + 64 >> 2] = n % 1000 * 1000 * 1000;
            HEAP64[e + 72 >> 3] = BigInt(Math.floor(a / 1000));
            HEAPU32[e + 80 >> 2] = a % 1000 * 1000 * 1000;
            HEAP64[e + 88 >> 3] = BigInt(r.ino);
            return 0;
          },
          writeStatFs(e, r) {
            HEAPU32[e + 4 >> 2] = r.bsize;
            HEAPU32[e + 60 >> 2] = r.bsize;
            HEAP64[e + 8 >> 3] = BigInt(r.blocks);
            HEAP64[e + 16 >> 3] = BigInt(r.bfree);
            HEAP64[e + 24 >> 3] = BigInt(r.bavail);
            HEAP64[e + 32 >> 3] = BigInt(r.files);
            HEAP64[e + 40 >> 3] = BigInt(r.ffree);
            HEAPU32[e + 48 >> 2] = r.fsid;
            HEAPU32[e + 64 >> 2] = r.flags;
            HEAPU32[e + 56 >> 2] = r.namelen;
          },
          doMsync(e, r, t, n, a) {
            if (!FS.isFile(r.node.mode)) {
              throw new FS.ErrnoError(43);
            }
            if (n & 2) {
              return 0;
            }
            var o = HEAPU8.slice(e, e + t);
            FS.msync(r, o, a, t, n);
          },
          getStreamFromFD(e) {
            var r = FS.getStreamChecked(e);
            return r;
          },
          varargs: undefined,
          getStr(e) {
            var r = UTF8ToString(e);
            return r;
          }
        };
        function ___syscall_chdir(e) {
          try {
            e = SYSCALLS.getStr(e);
            FS.chdir(e);
            return 0;
          } catch (r) {
            if (typeof FS === "undefined" || r.name !== "ErrnoError") {
              throw r;
            }
            return -r.errno;
          }
        }
        ___syscall_chdir.sig = "ip";
        function ___syscall_chmod(e, r) {
          try {
            e = SYSCALLS.getStr(e);
            FS.chmod(e, r);
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_chmod.sig = "ipi";
        function ___syscall_connect(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = getSocketAddress(r, t);
            l.sock_ops.connect(l, c.addr, c.port);
            return 0;
          } catch (_) {
            if (typeof FS === "undefined" || _.name !== "ErrnoError") {
              throw _;
            }
            return -_.errno;
          }
        }
        ___syscall_connect.sig = "iippiii";
        function ___syscall_dup(e) {
          try {
            var r = SYSCALLS.getStreamFromFD(e);
            return FS.dupStream(r).fd;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_dup.sig = "ii";
        function ___syscall_dup3(e, r, t) {
          try {
            var n = SYSCALLS.getStreamFromFD(e);
            if (n.fd === r) {
              return -28;
            }
            if (r < 0 || r >= FS.MAX_OPEN_FDS) {
              return -8;
            }
            var a = FS.getStream(r);
            if (a) {
              FS.close(a);
            }
            return FS.dupStream(n, r).fd;
          } catch (o) {
            if (typeof FS === "undefined" || o.name !== "ErrnoError") {
              throw o;
            }
            return -o.errno;
          }
        }
        ___syscall_dup3.sig = "iiii";
        function ___syscall_faccessat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            if (t & -8) {
              return -28;
            }
            var a = FS.lookupPath(r, {
              follow: true
            });
            var o = a.node;
            if (!o) {
              return -44;
            }
            var l = "";
            if (t & 4) {
              l += "r";
            }
            if (t & 2) {
              l += "w";
            }
            if (t & 1) {
              l += "x";
            }
            if (l && FS.nodePermissions(o, l)) {
              return -2;
            } else {
              return 0;
            }
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return -c.errno;
          }
        }
        ___syscall_faccessat.sig = "iipii";
        var ___syscall_fadvise64 = (e, r, t, n) => 0;
        ___syscall_fadvise64.sig = "iijji";
        var INT53_MAX = 9007199254740992;
        var INT53_MIN = -9007199254740992;
        var bigintToI53Checked = e => e < INT53_MIN || e > INT53_MAX ? NaN : Number(e);
        function ___syscall_fallocate(e, r, t, n) {
          t = bigintToI53Checked(t);
          n = bigintToI53Checked(n);
          try {
            if (isNaN(t) || isNaN(n)) {
              return -61;
            }
            if (r != 0) {
              return -138;
            }
            if (t < 0 || n < 0) {
              return -28;
            }
            var a = FS.fstat(e).size;
            var o = t + n;
            if (o > a) {
              FS.ftruncate(e, o);
            }
            return 0;
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return -l.errno;
          }
        }
        ___syscall_fallocate.sig = "iiijj";
        function ___syscall_fchdir(e) {
          try {
            var r = SYSCALLS.getStreamFromFD(e);
            FS.chdir(r.path);
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_fchdir.sig = "ii";
        function ___syscall_fchmod(e, r) {
          try {
            FS.fchmod(e, r);
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_fchmod.sig = "iii";
        function ___syscall_fchmodat2(e, r, t, n) {
          try {
            var a = n & 256;
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            FS.chmod(r, t, a);
            return 0;
          } catch (o) {
            if (typeof FS === "undefined" || o.name !== "ErrnoError") {
              throw o;
            }
            return -o.errno;
          }
        }
        ___syscall_fchmodat2.sig = "iipii";
        function ___syscall_fchown32(e, r, t) {
          try {
            FS.fchown(e, r, t);
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_fchown32.sig = "iiii";
        function ___syscall_fchownat(e, r, t, n, a) {
          try {
            r = SYSCALLS.getStr(r);
            var o = a & 256;
            a = a & -257;
            r = SYSCALLS.calculateAt(e, r);
            (o ? FS.lchown : FS.chown)(r, t, n);
            return 0;
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return -l.errno;
          }
        }
        ___syscall_fchownat.sig = "iipiii";
        var syscallGetVarargI = () => {
          var e = HEAP32[+SYSCALLS.varargs >> 2];
          SYSCALLS.varargs += 4;
          return e;
        };
        var syscallGetVarargP = syscallGetVarargI;
        function ___syscall_fcntl64(e, r, t) {
          SYSCALLS.varargs = t;
          try {
            var n = SYSCALLS.getStreamFromFD(e);
            switch (r) {
              case 0:
                {
                  var a = syscallGetVarargI();
                  if (a < 0) {
                    return -28;
                  }
                  while (FS.streams[a]) {
                    a++;
                  }
                  var o;
                  o = FS.dupStream(n, a);
                  return o.fd;
                }
              case 1:
              case 2:
                return 0;
              case 3:
                return n.flags;
              case 4:
                {
                  var a = syscallGetVarargI();
                  n.flags |= a;
                  return 0;
                }
              case 12:
                {
                  var a = syscallGetVarargP();
                  var l = 0;
                  HEAP16[a + l >> 1] = 2;
                  return 0;
                }
              case 13:
              case 14:
                return 0;
            }
            return -28;
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return -c.errno;
          }
        }
        ___syscall_fcntl64.sig = "iiip";
        function ___syscall_fdatasync(e) {
          try {
            var r = SYSCALLS.getStreamFromFD(e);
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_fdatasync.sig = "ii";
        function ___syscall_fstat64(e, r) {
          try {
            return SYSCALLS.writeStat(r, FS.fstat(e));
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_fstat64.sig = "iip";
        function ___syscall_fstatfs64(e, r, t) {
          try {
            var n = SYSCALLS.getStreamFromFD(e);
            SYSCALLS.writeStatFs(t, FS.statfsStream(n));
            return 0;
          } catch (a) {
            if (typeof FS === "undefined" || a.name !== "ErrnoError") {
              throw a;
            }
            return -a.errno;
          }
        }
        ___syscall_fstatfs64.sig = "iipp";
        function ___syscall_ftruncate64(e, r) {
          r = bigintToI53Checked(r);
          try {
            if (isNaN(r)) {
              return -61;
            } else {
              FS.ftruncate(e, r);
              return 0;
            }
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_ftruncate64.sig = "iij";
        function ___syscall_getcwd(e, r) {
          try {
            if (r === 0) {
              return -28;
            }
            var t = FS.cwd();
            var n = lengthBytesUTF8(t) + 1;
            if (r < n) {
              return -68;
            } else {
              stringToUTF8(t, e, r);
              return n;
            }
          } catch (a) {
            if (typeof FS === "undefined" || a.name !== "ErrnoError") {
              throw a;
            }
            return -a.errno;
          }
        }
        ___syscall_getcwd.sig = "ipp";
        function ___syscall_getdents64(e, r, t) {
          try {
            var n = SYSCALLS.getStreamFromFD(e);
            n.getdents ||= FS.readdir(n.path);
            var a = 280;
            var o = 0;
            var l = FS.llseek(n, 0, 1);
            var c = Math.floor(l / a);
            for (var _ = Math.min(n.getdents.length, c + Math.floor(t / a)), u = c; u < _; u++) {
              var m;
              var f;
              var v = n.getdents[u];
              if (v === ".") {
                m = n.node.id;
                f = 4;
              } else if (v === "..") {
                var g = FS.lookupPath(n.path, {
                  parent: true
                });
                m = g.node.id;
                f = 4;
              } else {
                var h;
                try {
                  h = FS.lookupNode(n.node, v);
                } catch (p) {
                  if (p?.errno === 28) {
                    continue;
                  }
                  throw p;
                }
                m = h.id;
                f = FS.isChrdev(h.mode) ? 2 : FS.isDir(h.mode) ? 4 : FS.isLink(h.mode) ? 10 : 8;
              }
              HEAP64[r + o >> 3] = BigInt(m);
              HEAP64[r + o + 8 >> 3] = BigInt((u + 1) * a);
              HEAP16[r + o + 16 >> 1] = 280;
              HEAP8[r + o + 18] = f;
              stringToUTF8(v, r + o + 19, 256);
              o += a;
            }
            FS.llseek(n, u * a, 0);
            return o;
          } catch (p) {
            if (typeof FS === "undefined" || p.name !== "ErrnoError") {
              throw p;
            }
            return -p.errno;
          }
        }
        ___syscall_getdents64.sig = "iipp";
        function ___syscall_getpeername(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            if (!l.daddr) {
              return -53;
            }
            var c = writeSockaddr(r, l.family, DNS.lookup_name(l.daddr), l.dport, t);
            return 0;
          } catch (_) {
            if (typeof FS === "undefined" || _.name !== "ErrnoError") {
              throw _;
            }
            return -_.errno;
          }
        }
        ___syscall_getpeername.sig = "iippiii";
        function ___syscall_getsockname(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = writeSockaddr(r, l.family, DNS.lookup_name(l.saddr || "0.0.0.0"), l.sport, t);
            return 0;
          } catch (_) {
            if (typeof FS === "undefined" || _.name !== "ErrnoError") {
              throw _;
            }
            return -_.errno;
          }
        }
        ___syscall_getsockname.sig = "iippiii";
        function ___syscall_getsockopt(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            if (r === 1 && t === 4) {
              HEAP32[n >> 2] = l.error;
              HEAP32[a >> 2] = 4;
              l.error = null;
              return 0;
            } else {
              return -50;
            }
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return -c.errno;
          }
        }
        ___syscall_getsockopt.sig = "iiiippi";
        function ___syscall_ioctl(e, r, t) {
          SYSCALLS.varargs = t;
          try {
            var n = SYSCALLS.getStreamFromFD(e);
            switch (r) {
              case 21509:
                if (n.tty) {
                  return 0;
                } else {
                  return -59;
                }
              case 21505:
                {
                  if (!n.tty) {
                    return -59;
                  }
                  if (n.tty.ops.ioctl_tcgets) {
                    var a = n.tty.ops.ioctl_tcgets(n);
                    var o = syscallGetVarargP();
                    HEAP32[o >> 2] = a.c_iflag || 0;
                    HEAP32[o + 4 >> 2] = a.c_oflag || 0;
                    HEAP32[o + 8 >> 2] = a.c_cflag || 0;
                    HEAP32[o + 12 >> 2] = a.c_lflag || 0;
                    for (var l = 0; l < 32; l++) {
                      HEAP8[o + l + 17] = a.c_cc[l] || 0;
                    }
                    return 0;
                  }
                  return 0;
                }
              case 21510:
              case 21511:
              case 21512:
                if (n.tty) {
                  return 0;
                } else {
                  return -59;
                }
              case 21506:
              case 21507:
              case 21508:
                {
                  if (!n.tty) {
                    return -59;
                  }
                  if (n.tty.ops.ioctl_tcsets) {
                    var o = syscallGetVarargP();
                    var c = HEAP32[o >> 2];
                    var _ = HEAP32[o + 4 >> 2];
                    var u = HEAP32[o + 8 >> 2];
                    var m = HEAP32[o + 12 >> 2];
                    var f = [];
                    for (var l = 0; l < 32; l++) {
                      f.push(HEAP8[o + l + 17]);
                    }
                    return n.tty.ops.ioctl_tcsets(n.tty, r, {
                      c_iflag: c,
                      c_oflag: _,
                      c_cflag: u,
                      c_lflag: m,
                      c_cc: f
                    });
                  }
                  return 0;
                }
              case 21519:
                {
                  if (!n.tty) {
                    return -59;
                  }
                  var o = syscallGetVarargP();
                  HEAP32[o >> 2] = 0;
                  return 0;
                }
              case 21520:
                if (n.tty) {
                  return -28;
                } else {
                  return -59;
                }
              case 21537:
              case 21531:
                {
                  var o = syscallGetVarargP();
                  return FS.ioctl(n, r, o);
                }
              case 21523:
                {
                  if (!n.tty) {
                    return -59;
                  }
                  if (n.tty.ops.ioctl_tiocgwinsz) {
                    var v = n.tty.ops.ioctl_tiocgwinsz(n.tty);
                    var o = syscallGetVarargP();
                    HEAP16[o >> 1] = v[0];
                    HEAP16[o + 2 >> 1] = v[1];
                  }
                  return 0;
                }
              case 21524:
                if (n.tty) {
                  return 0;
                } else {
                  return -59;
                }
              case 21515:
                if (n.tty) {
                  return 0;
                } else {
                  return -59;
                }
              default:
                return -28;
            }
          } catch (g) {
            if (typeof FS === "undefined" || g.name !== "ErrnoError") {
              throw g;
            }
            return -g.errno;
          }
        }
        ___syscall_ioctl.sig = "iiip";
        function ___syscall_listen(e, r) {
          try {
            var t = getSocketFromFD(e);
            t.sock_ops.listen(t, r);
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_listen.sig = "iiiiiii";
        function ___syscall_lstat64(e, r) {
          try {
            e = SYSCALLS.getStr(e);
            return SYSCALLS.writeStat(r, FS.lstat(e));
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_lstat64.sig = "ipp";
        function ___syscall_mkdirat(e, r, t) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            FS.mkdir(r, t, 0);
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_mkdirat.sig = "iipi";
        function ___syscall_mknodat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            switch (t & 61440) {
              case 32768:
              case 8192:
              case 24576:
              case 4096:
              case 49152:
                break;
              default:
                return -28;
            }
            FS.mknod(r, t, n);
            return 0;
          } catch (a) {
            if (typeof FS === "undefined" || a.name !== "ErrnoError") {
              throw a;
            }
            return -a.errno;
          }
        }
        ___syscall_mknodat.sig = "iipii";
        function ___syscall_newfstatat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            var a = n & 256;
            var o = n & 4096;
            n = n & -6401;
            r = SYSCALLS.calculateAt(e, r, o);
            return SYSCALLS.writeStat(t, a ? FS.lstat(r) : FS.stat(r));
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return -l.errno;
          }
        }
        ___syscall_newfstatat.sig = "iippi";
        function ___syscall_openat(e, r, t, n) {
          SYSCALLS.varargs = n;
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            var a = n ? syscallGetVarargI() : 0;
            return FS.open(r, t, a).fd;
          } catch (o) {
            if (typeof FS === "undefined" || o.name !== "ErrnoError") {
              throw o;
            }
            return -o.errno;
          }
        }
        ___syscall_openat.sig = "iipip";
        var PIPEFS = {
          BUCKET_BUFFER_SIZE: 8192,
          mount(e) {
            return FS.createNode(null, "/", 16895, 0);
          },
          createPipe() {
            var e = {
              buckets: [],
              refcnt: 2,
              timestamp: new Date()
            };
            e.buckets.push({
              buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
              offset: 0,
              roffset: 0
            });
            var r = PIPEFS.nextname();
            var t = PIPEFS.nextname();
            var n = FS.createNode(PIPEFS.root, r, 4096, 0);
            var a = FS.createNode(PIPEFS.root, t, 4096, 0);
            n.pipe = e;
            a.pipe = e;
            var o = FS.createStream({
              path: r,
              node: n,
              flags: 0,
              seekable: false,
              stream_ops: PIPEFS.stream_ops
            });
            n.stream = o;
            var l = FS.createStream({
              path: t,
              node: a,
              flags: 1,
              seekable: false,
              stream_ops: PIPEFS.stream_ops
            });
            a.stream = l;
            return {
              readable_fd: o.fd,
              writable_fd: l.fd
            };
          },
          stream_ops: {
            getattr(e) {
              var r = e.node;
              var t = r.pipe.timestamp;
              return {
                dev: 14,
                ino: r.id,
                mode: 4480,
                nlink: 1,
                uid: 0,
                gid: 0,
                rdev: 0,
                size: 0,
                atime: t,
                mtime: t,
                ctime: t,
                blksize: 4096,
                blocks: 0
              };
            },
            poll(e, r, t) {
              var n = e.node.pipe;
              if ((e.flags & 2097155) === 1) {
                return 260;
              }
              for (var a of n.buckets) {
                if (a.offset - a.roffset > 0) {
                  return 65;
                }
              }
              return 0;
            },
            dup(e) {
              e.node.pipe.refcnt++;
            },
            ioctl(e, r, t) {
              return 28;
            },
            fsync(e) {
              return 28;
            },
            read(e, r, t, n, a) {
              var o = e.node.pipe;
              var l = 0;
              for (var c of o.buckets) {
                l += c.offset - c.roffset;
              }
              var _ = r.subarray(t, t + n);
              if (n <= 0) {
                return 0;
              }
              if (l == 0) {
                throw new FS.ErrnoError(6);
              }
              var u = Math.min(l, n);
              var m = u;
              var f = 0;
              for (var c of o.buckets) {
                var v = c.offset - c.roffset;
                if (u <= v) {
                  var g = c.buffer.subarray(c.roffset, c.offset);
                  if (u < v) {
                    g = g.subarray(0, u);
                    c.roffset += u;
                  } else {
                    f++;
                  }
                  _.set(g);
                  break;
                } else {
                  var g = c.buffer.subarray(c.roffset, c.offset);
                  _.set(g);
                  _ = _.subarray(g.byteLength);
                  u -= g.byteLength;
                  f++;
                }
              }
              if (f && f == o.buckets.length) {
                f--;
                o.buckets[f].offset = 0;
                o.buckets[f].roffset = 0;
              }
              o.buckets.splice(0, f);
              return m;
            },
            write(e, r, t, n, a) {
              var o = e.node.pipe;
              var l = r.subarray(t, t + n);
              var c = l.byteLength;
              if (c <= 0) {
                return 0;
              }
              var _ = null;
              if (o.buckets.length == 0) {
                _ = {
                  buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
                  offset: 0,
                  roffset: 0
                };
                o.buckets.push(_);
              } else {
                _ = o.buckets[o.buckets.length - 1];
              }
              var u = PIPEFS.BUCKET_BUFFER_SIZE - _.offset;
              if (u >= c) {
                _.buffer.set(l, _.offset);
                _.offset += c;
                return c;
              }
              if (u > 0) {
                _.buffer.set(l.subarray(0, u), _.offset);
                _.offset += u;
                l = l.subarray(u, l.byteLength);
              }
              for (var m = l.byteLength / PIPEFS.BUCKET_BUFFER_SIZE | 0, f = l.byteLength % PIPEFS.BUCKET_BUFFER_SIZE, v = 0; v < m; v++) {
                var g = {
                  buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
                  offset: PIPEFS.BUCKET_BUFFER_SIZE,
                  roffset: 0
                };
                o.buckets.push(g);
                g.buffer.set(l.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE));
                l = l.subarray(PIPEFS.BUCKET_BUFFER_SIZE, l.byteLength);
              }
              if (f > 0) {
                var g = {
                  buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
                  offset: l.byteLength,
                  roffset: 0
                };
                o.buckets.push(g);
                g.buffer.set(l);
              }
              return c;
            },
            close(e) {
              var r = e.node.pipe;
              r.refcnt--;
              if (r.refcnt === 0) {
                r.buckets = null;
              }
            }
          },
          nextname() {
            PIPEFS.nextname.current ||= 0;
            return "pipe[" + PIPEFS.nextname.current++ + "]";
          }
        };
        function ___syscall_pipe(e) {
          try {
            if (e == 0) {
              throw new FS.ErrnoError(21);
            }
            var r = PIPEFS.createPipe();
            HEAP32[e >> 2] = r.readable_fd;
            HEAP32[e + 4 >> 2] = r.writable_fd;
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_pipe.sig = "ip";
        function ___syscall_readlinkat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            if (n <= 0) {
              return -28;
            }
            var a = FS.readlink(r);
            var o = Math.min(n, lengthBytesUTF8(a));
            var l = HEAP8[t + o];
            stringToUTF8(a, t, n + 1);
            HEAP8[t + o] = l;
            return o;
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return -c.errno;
          }
        }
        ___syscall_readlinkat.sig = "iippp";
        function ___syscall_recvfrom(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = l.sock_ops.recvmsg(l, t);
            if (!c) {
              return 0;
            }
            if (a) {
              var _ = writeSockaddr(a, l.family, DNS.lookup_name(c.addr), c.port, o);
            }
            HEAPU8.set(c.buffer, r);
            return c.buffer.byteLength;
          } catch (u) {
            if (typeof FS === "undefined" || u.name !== "ErrnoError") {
              throw u;
            }
            return -u.errno;
          }
        }
        ___syscall_recvfrom.sig = "iippipp";
        function ___syscall_recvmsg(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = HEAPU32[r + 8 >> 2];
            for (var _ = HEAP32[r + 12 >> 2], u = 0, m = 0; m < _; m++) {
              u += HEAP32[c + (m * 8 + 4) >> 2];
            }
            var f = l.sock_ops.recvmsg(l, u);
            if (!f) {
              return 0;
            }
            var v = HEAPU32[r >> 2];
            if (v) {
              var g = writeSockaddr(v, l.family, DNS.lookup_name(f.addr), f.port);
            }
            var h = 0;
            for (var p = f.buffer.byteLength, m = 0; p > 0 && m < _; m++) {
              var b = HEAPU32[c + (m * 8 + 0) >> 2];
              var S = HEAP32[c + (m * 8 + 4) >> 2];
              if (S) {
                var w = Math.min(S, p);
                var A = f.buffer.subarray(h, h + w);
                HEAPU8.set(A, b + h);
                h += w;
                p -= w;
              }
            }
            return h;
          } catch (k) {
            if (typeof FS === "undefined" || k.name !== "ErrnoError") {
              throw k;
            }
            return -k.errno;
          }
        }
        ___syscall_recvmsg.sig = "iipiiii";
        function ___syscall_renameat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            n = SYSCALLS.getStr(n);
            r = SYSCALLS.calculateAt(e, r);
            n = SYSCALLS.calculateAt(t, n);
            FS.rename(r, n);
            return 0;
          } catch (a) {
            if (typeof FS === "undefined" || a.name !== "ErrnoError") {
              throw a;
            }
            return -a.errno;
          }
        }
        ___syscall_renameat.sig = "iipip";
        function ___syscall_rmdir(e) {
          try {
            e = SYSCALLS.getStr(e);
            FS.rmdir(e);
            return 0;
          } catch (r) {
            if (typeof FS === "undefined" || r.name !== "ErrnoError") {
              throw r;
            }
            return -r.errno;
          }
        }
        ___syscall_rmdir.sig = "ip";
        function ___syscall_sendmsg(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            var c = HEAPU32[r + 8 >> 2];
            var _ = HEAP32[r + 12 >> 2];
            var u;
            var m;
            var f = HEAPU32[r >> 2];
            var v = HEAP32[r + 4 >> 2];
            if (f) {
              var g = getSocketAddress(f, v);
              m = g.port;
              u = g.addr;
            }
            var h = 0;
            for (var p = 0; p < _; p++) {
              h += HEAP32[c + (p * 8 + 4) >> 2];
            }
            var b = new Uint8Array(h);
            var S = 0;
            for (var p = 0; p < _; p++) {
              var w = HEAPU32[c + (p * 8 + 0) >> 2];
              for (var A = HEAP32[c + (p * 8 + 4) >> 2], k = 0; k < A; k++) {
                b[S++] = HEAP8[w + k];
              }
            }
            return l.sock_ops.sendmsg(l, b, 0, h, u, m);
          } catch (G) {
            if (typeof FS === "undefined" || G.name !== "ErrnoError") {
              throw G;
            }
            return -G.errno;
          }
        }
        ___syscall_sendmsg.sig = "iipippi";
        function ___syscall_sendto(e, r, t, n, a, o) {
          try {
            var l = getSocketFromFD(e);
            if (!a) {
              return FS.write(l.stream, HEAP8, r, t);
            }
            var c = getSocketAddress(a, o);
            return l.sock_ops.sendmsg(l, HEAP8, r, t, c.addr, c.port);
          } catch (_) {
            if (typeof FS === "undefined" || _.name !== "ErrnoError") {
              throw _;
            }
            return -_.errno;
          }
        }
        ___syscall_sendto.sig = "iippipp";
        function ___syscall_socket(e, r, t) {
          try {
            var n = SOCKFS.createSocket(e, r, t);
            return n.stream.fd;
          } catch (a) {
            if (typeof FS === "undefined" || a.name !== "ErrnoError") {
              throw a;
            }
            return -a.errno;
          }
        }
        ___syscall_socket.sig = "iiiiiii";
        function ___syscall_stat64(e, r) {
          try {
            e = SYSCALLS.getStr(e);
            return SYSCALLS.writeStat(r, FS.stat(e));
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_stat64.sig = "ipp";
        function ___syscall_statfs64(e, r, t) {
          try {
            SYSCALLS.writeStatFs(t, FS.statfs(SYSCALLS.getStr(e)));
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_statfs64.sig = "ippp";
        function ___syscall_symlinkat(e, r, t) {
          try {
            e = SYSCALLS.getStr(e);
            t = SYSCALLS.getStr(t);
            t = SYSCALLS.calculateAt(r, t);
            FS.symlink(e, t);
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_symlinkat.sig = "ipip";
        function ___syscall_truncate64(e, r) {
          r = bigintToI53Checked(r);
          try {
            if (isNaN(r)) {
              return -61;
            } else {
              e = SYSCALLS.getStr(e);
              FS.truncate(e, r);
              return 0;
            }
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_truncate64.sig = "ipj";
        function ___syscall_unlinkat(e, r, t) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r);
            if (!t) {
              FS.unlink(r);
            } else if (t === 512) {
              FS.rmdir(r);
            } else {
              return -28;
            }
            return 0;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return -n.errno;
          }
        }
        ___syscall_unlinkat.sig = "iipi";
        var readI53FromI64 = e => HEAPU32[e >> 2] + HEAP32[e + 4 >> 2] * 4294967296;
        function ___syscall_utimensat(e, r, t, n) {
          try {
            r = SYSCALLS.getStr(r);
            r = SYSCALLS.calculateAt(e, r, true);
            var a = Date.now();
            var o;
            var l;
            if (!t) {
              o = a;
              l = a;
            } else {
              var c = readI53FromI64(t);
              var _ = HEAP32[t + 8 >> 2];
              if (_ == 1073741823) {
                o = a;
              } else if (_ == 1073741822) {
                o = null;
              } else {
                o = c * 1000 + _ / 1000000;
              }
              t += 16;
              c = readI53FromI64(t);
              _ = HEAP32[t + 8 >> 2];
              if (_ == 1073741823) {
                l = a;
              } else if (_ == 1073741822) {
                l = null;
              } else {
                l = c * 1000 + _ / 1000000;
              }
            }
            if ((l ?? o) !== null) {
              FS.utime(r, o, l);
            }
            return 0;
          } catch (u) {
            if (typeof FS === "undefined" || u.name !== "ErrnoError") {
              throw u;
            }
            return -u.errno;
          }
        }
        ___syscall_utimensat.sig = "iippi";
        var __abort_js = () => abort("");
        __abort_js.sig = "v";
        var dlSetError = e => {
          var r = stackSave();
          var t = stringToUTF8OnStack(e);
          ___dl_seterr(t, 0);
          stackRestore(r);
        };
        var dlopenInternal = (e, r) => {
          var t = UTF8ToString(e + 36);
          var n = HEAP32[e + 4 >> 2];
          t = PATH.normalize(t);
          var a = [];
          var o = !!(n & 256);
          var l = o ? null : {};
          var c = {
            global: o,
            nodelete: !!(n & 4096),
            loadAsync: r.loadAsync
          };
          if (r.loadAsync) {
            return loadDynamicLibrary(t, c, l, e);
          }
          try {
            return loadDynamicLibrary(t, c, l, e);
          } catch (_) {
            dlSetError(`could not load dynamic lib: ${t}
${_}`);
            return 0;
          }
        };
        var __dlopen_js = e => dlopenInternal(e, {
          loadAsync: false
        });
        __dlopen_js.sig = "pp";
        var __dlsym_js = (e, r, t) => {
          r = UTF8ToString(r);
          var n;
          var a;
          var o = LDSO.loadedLibsByHandle[e];
          a = Object.keys(o.exports).indexOf(r);
          if (a == -1 || o.exports[r].stub) {
            dlSetError(`Tried to lookup unknown symbol "${r}" in dynamic lib: ${o.name}`);
            return 0;
          }
          n = o.exports[r];
          if (typeof n == "function") {
            var l = getFunctionAddress(n);
            if (l) {
              n = l;
            } else {
              n = addFunction(n, n.sig);
              HEAPU32[t >> 2] = a;
            }
          }
          return n;
        };
        __dlsym_js.sig = "pppp";
        var handleException = e => {
          if (e instanceof ExitStatus || e == "unwind") {
            return EXITSTATUS;
          }
          quit_(1, e);
        };
        var runtimeKeepaliveCounter = 0;
        var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
        var _proc_exit = e => {
          EXITSTATUS = e;
          if (!keepRuntimeAlive()) {
            Module.onExit?.(e);
            ABORT = true;
          }
          quit_(e, new ExitStatus(e));
        };
        _proc_exit.sig = "vi";
        var exitJS = (e, r) => {
          EXITSTATUS = e;
          _proc_exit(e);
        };
        var _exit = exitJS;
        _exit.sig = "vi";
        var maybeExit = () => {
          if (!keepRuntimeAlive()) {
            try {
              _exit(EXITSTATUS);
            } catch (e) {
              handleException(e);
            }
          }
        };
        var callUserCallback = e => {
          if (!ABORT) {
            try {
              e();
              maybeExit();
            } catch (r) {
              handleException(r);
            }
          }
        };
        var __emscripten_dlopen_js = (e, r, t, n) => {
          function a(c) {
            var _ = UTF8ToString(e + 36);
            dlSetError(`'Could not load dynamic lib: ${_}
${c}`);
            callUserCallback(() => getWasmTableEntry(t)(e, n));
          }
          function o() {
            callUserCallback(() => getWasmTableEntry(r)(e, n));
          }
          var l = dlopenInternal(e, {
            loadAsync: true
          });
          if (l) {
            l.then(o, a);
          } else {
            a();
          }
        };
        __emscripten_dlopen_js.sig = "vpppp";
        var onExits = [];
        var addOnExit = e => onExits.push(e);
        var JSEvents = {
          removeAllEventListeners() {
            while (JSEvents.eventHandlers.length) {
              JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
            }
            JSEvents.deferredCalls = [];
          },
          inEventHandler: 0,
          deferredCalls: [],
          deferCall(e, r, t) {
            function n(o, l) {
              if (o.length != l.length) {
                return false;
              }
              for (var c in o) {
                if (o[c] != l[c]) {
                  return false;
                }
              }
              return true;
            }
            for (var a of JSEvents.deferredCalls) {
              if (a.targetFunction == e && n(a.argsList, t)) {
                return;
              }
            }
            JSEvents.deferredCalls.push({
              targetFunction: e,
              precedence: r,
              argsList: t
            });
            JSEvents.deferredCalls.sort((o, l) => o.precedence < l.precedence);
          },
          removeDeferredCalls(e) {
            JSEvents.deferredCalls = JSEvents.deferredCalls.filter(r => r.targetFunction != e);
          },
          canPerformEventHandlerRequests() {
            if (navigator.userActivation) {
              return navigator.userActivation.isActive;
            } else {
              return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
            }
          },
          runDeferredCalls() {
            if (JSEvents.canPerformEventHandlerRequests()) {
              var e = JSEvents.deferredCalls;
              JSEvents.deferredCalls = [];
              for (var r of e) {
                r.targetFunction(...r.argsList);
              }
            }
          },
          eventHandlers: [],
          removeAllHandlersOnTarget: (e, r) => {
            for (var t = 0; t < JSEvents.eventHandlers.length; ++t) {
              if (JSEvents.eventHandlers[t].target == e && (!r || r == JSEvents.eventHandlers[t].eventTypeString)) {
                JSEvents._removeHandler(t--);
              }
            }
          },
          _removeHandler(e) {
            var r = JSEvents.eventHandlers[e];
            r.target.removeEventListener(r.eventTypeString, r.eventListenerFunc, r.useCapture);
            JSEvents.eventHandlers.splice(e, 1);
          },
          registerOrRemoveHandler(e) {
            if (!e.target) {
              return -4;
            }
            if (e.callbackfunc) {
              e.eventListenerFunc = function (t) {
                ++JSEvents.inEventHandler;
                JSEvents.currentEventHandler = e;
                JSEvents.runDeferredCalls();
                e.handlerFunc(t);
                JSEvents.runDeferredCalls();
                --JSEvents.inEventHandler;
              };
              e.target.addEventListener(e.eventTypeString, e.eventListenerFunc, e.useCapture);
              JSEvents.eventHandlers.push(e);
            } else {
              for (var r = 0; r < JSEvents.eventHandlers.length; ++r) {
                if (JSEvents.eventHandlers[r].target == e.target && JSEvents.eventHandlers[r].eventTypeString == e.eventTypeString) {
                  JSEvents._removeHandler(r--);
                }
              }
            }
            return 0;
          },
          removeSingleHandler(e) {
            let r = false;
            for (let t = 0; t < JSEvents.eventHandlers.length; ++t) {
              let n = JSEvents.eventHandlers[t];
              if (n.target === e.target && n.eventTypeId === e.eventTypeId && n.callbackfunc === e.callbackfunc && n.userData === e.userData) {
                JSEvents._removeHandler(t--);
                r = true;
              }
            }
            if (r) {
              return 0;
            } else {
              return -5;
            }
          },
          getNodeNameForTarget(e) {
            if (e) {
              if (e == window) {
                return "#window";
              } else if (e == screen) {
                return "#screen";
              } else {
                return e?.nodeName || "";
              }
            } else {
              return "";
            }
          },
          fullscreenEnabled() {
            return document.fullscreenEnabled || document.webkitFullscreenEnabled;
          }
        };
        var __emscripten_get_last_devicemotion_event = () => JSEvents.deviceMotionEvent;
        __emscripten_get_last_devicemotion_event.sig = "p";
        var __emscripten_get_last_deviceorientation_event = () => JSEvents.deviceOrientationEvent;
        __emscripten_get_last_deviceorientation_event.sig = "p";
        var __emscripten_get_last_mouse_event = () => JSEvents.mouseEvent;
        __emscripten_get_last_mouse_event.sig = "p";
        var getExecutableName = () => thisProgram || "./this.program";
        var __emscripten_get_progname = (e, r) => stringToUTF8(getExecutableName(), e, r);
        __emscripten_get_progname.sig = "vpi";
        var jsStackTrace = () => new Error().stack.toString();
        var getCallstack = e => {
          var r = jsStackTrace();
          var t = r.split(`
`);
          r = "";
          var n = new RegExp("\\s*(.*?)@(.*?):([0-9]+):([0-9]+)");
          var a = new RegExp("\\s*at (.*?) \\((.*):(.*):(.*)\\)");
          for (var o of t) {
            var l = "";
            var c = "";
            var _ = 0;
            var u = 0;
            var m = a.exec(o);
            if (m?.length == 5) {
              l = m[1];
              c = m[2];
              _ = m[3];
              u = m[4];
            } else {
              m = n.exec(o);
              if (m?.length >= 4) {
                l = m[1];
                c = m[2];
                _ = m[3];
                u = m[4] | 0;
              } else {
                r += `${o}
`;
                continue;
              }
            }
            if (l == "_emscripten_log" || l == "_emscripten_get_callstack") {
              r = "";
              continue;
            }
            if (e & 24) {
              if (e & 64) {
                c = c.substring(c.replace(/\\/g, "/").lastIndexOf("/") + 1);
              }
              r += `    at ${l} (${c}:${_}:${u})
`;
            }
          }
          r = r.replace(/\s+$/, "");
          return r;
        };
        var __emscripten_log_formatted = (e, r) => {
          r = UTF8ToString(r);
          if (e & 24) {
            r = r.replace(/\s+$/, "");
            r += (r.length > 0 ? `
` : "") + getCallstack(e);
          }
          if (e & 1) {
            if (e & 4) {
              console.error(r);
            } else if (e & 2) {
              console.warn(r);
            } else if (e & 512) {
              console.info(r);
            } else if (e & 256) {
              console.debug(r);
            } else {
              console.log(r);
            }
          } else if (e & 6) {
            err(r);
          } else {
            out(r);
          }
        };
        __emscripten_log_formatted.sig = "vip";
        var __emscripten_lookup_name = e => {
          var r = UTF8ToString(e);
          return inetPton4(DNS.lookup_name(r));
        };
        __emscripten_lookup_name.sig = "ip";
        var __emscripten_runtime_keepalive_clear = () => {
          noExitRuntime = false;
          runtimeKeepaliveCounter = 0;
        };
        __emscripten_runtime_keepalive_clear.sig = "v";
        var __emscripten_system = e => e ? -52 : 0;
        __emscripten_system.sig = "ip";
        var __emscripten_throw_longjmp = () => {
          throw Infinity;
        };
        __emscripten_throw_longjmp.sig = "v";
        function __gmtime_js(e, r) {
          e = bigintToI53Checked(e);
          var t = new Date(e * 1000);
          HEAP32[r >> 2] = t.getUTCSeconds();
          HEAP32[r + 4 >> 2] = t.getUTCMinutes();
          HEAP32[r + 8 >> 2] = t.getUTCHours();
          HEAP32[r + 12 >> 2] = t.getUTCDate();
          HEAP32[r + 16 >> 2] = t.getUTCMonth();
          HEAP32[r + 20 >> 2] = t.getUTCFullYear() - 1900;
          HEAP32[r + 24 >> 2] = t.getUTCDay();
          var n = Date.UTC(t.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
          var a = (t.getTime() - n) / 86400000 | 0;
          HEAP32[r + 28 >> 2] = a;
        }
        __gmtime_js.sig = "vjp";
        var isLeapYear = e => e % 4 === 0 && (e % 100 !== 0 || e % 400 === 0);
        var MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        var MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var ydayFromDate = e => {
          var r = isLeapYear(e.getFullYear());
          var t = r ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE;
          var n = t[e.getMonth()] + e.getDate() - 1;
          return n;
        };
        function __localtime_js(e, r) {
          e = bigintToI53Checked(e);
          var t = new Date(e * 1000);
          HEAP32[r >> 2] = t.getSeconds();
          HEAP32[r + 4 >> 2] = t.getMinutes();
          HEAP32[r + 8 >> 2] = t.getHours();
          HEAP32[r + 12 >> 2] = t.getDate();
          HEAP32[r + 16 >> 2] = t.getMonth();
          HEAP32[r + 20 >> 2] = t.getFullYear() - 1900;
          HEAP32[r + 24 >> 2] = t.getDay();
          var n = ydayFromDate(t) | 0;
          HEAP32[r + 28 >> 2] = n;
          HEAP32[r + 36 >> 2] = -(t.getTimezoneOffset() * 60);
          var a = new Date(t.getFullYear(), 0, 1);
          var o = new Date(t.getFullYear(), 6, 1).getTimezoneOffset();
          var l = a.getTimezoneOffset();
          var c = (o != l && t.getTimezoneOffset() == Math.min(l, o)) | 0;
          HEAP32[r + 32 >> 2] = c;
        }
        __localtime_js.sig = "vjp";
        var __mktime_js = function (e) {
          var r = (() => {
            var t = new Date(HEAP32[e + 20 >> 2] + 1900, HEAP32[e + 16 >> 2], HEAP32[e + 12 >> 2], HEAP32[e + 8 >> 2], HEAP32[e + 4 >> 2], HEAP32[e >> 2], 0);
            var n = HEAP32[e + 32 >> 2];
            var a = t.getTimezoneOffset();
            var o = new Date(t.getFullYear(), 0, 1);
            var l = new Date(t.getFullYear(), 6, 1).getTimezoneOffset();
            var c = o.getTimezoneOffset();
            var _ = Math.min(c, l);
            if (n < 0) {
              HEAP32[e + 32 >> 2] = +(l != c && _ == a);
            } else if (n > 0 != (_ == a)) {
              var u = Math.max(c, l);
              var m = n > 0 ? _ : u;
              t.setTime(t.getTime() + (m - a) * 60000);
            }
            HEAP32[e + 24 >> 2] = t.getDay();
            var f = ydayFromDate(t) | 0;
            HEAP32[e + 28 >> 2] = f;
            HEAP32[e >> 2] = t.getSeconds();
            HEAP32[e + 4 >> 2] = t.getMinutes();
            HEAP32[e + 8 >> 2] = t.getHours();
            HEAP32[e + 12 >> 2] = t.getDate();
            HEAP32[e + 16 >> 2] = t.getMonth();
            HEAP32[e + 20 >> 2] = t.getYear();
            var v = t.getTime();
            if (isNaN(v)) {
              return -1;
            } else {
              return v / 1000;
            }
          })();
          return BigInt(r);
        };
        __mktime_js.sig = "jp";
        function __mmap_js(e, r, t, n, a, o, l) {
          a = bigintToI53Checked(a);
          try {
            var c = SYSCALLS.getStreamFromFD(n);
            var _ = FS.mmap(c, e, a, r, t);
            var u = _.ptr;
            HEAP32[o >> 2] = _.allocated;
            HEAPU32[l >> 2] = u;
            return 0;
          } catch (m) {
            if (typeof FS === "undefined" || m.name !== "ErrnoError") {
              throw m;
            }
            return -m.errno;
          }
        }
        __mmap_js.sig = "ipiiijpp";
        function __msync_js(e, r, t, n, a, o) {
          o = bigintToI53Checked(o);
          try {
            if (isNaN(o)) {
              return -61;
            } else {
              SYSCALLS.doMsync(e, SYSCALLS.getStreamFromFD(a), r, n, o);
              return 0;
            }
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return -l.errno;
          }
        }
        __msync_js.sig = "ippiiij";
        function __munmap_js(e, r, t, n, a, o) {
          o = bigintToI53Checked(o);
          try {
            var l = SYSCALLS.getStreamFromFD(a);
            if (t & 2) {
              SYSCALLS.doMsync(e, l, r, n, o);
            }
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return -c.errno;
          }
        }
        __munmap_js.sig = "ippiiij";
        function __poll_js(e, r, t, n, a) {
          try {
            var o = 0;
            for (var l = 0; l < r; l++) {
              var c = e + l * 8;
              var _ = HEAP32[c >> 2];
              var u = HEAP16[c + 4 >> 1];
              var m = 32;
              var f = FS.getStream(_);
              if (f) {
                if (f.stream_ops.poll) {
                  m = f.stream_ops.poll(f, -1);
                } else {
                  m = 5;
                }
              }
              m &= u | 8 | 16;
              if (m) {
                o++;
              }
              HEAP16[c + 6 >> 1] = m;
            }
            return o;
          } catch (v) {
            if (typeof FS === "undefined" || v.name !== "ErrnoError") {
              throw v;
            }
            return -v.errno;
          }
        }
        __poll_js.sig = "ipiipp";
        var timers = {};
        var _emscripten_get_now = () => performance.now();
        _emscripten_get_now.sig = "d";
        var __setitimer_js = (e, r) => {
          if (timers[e]) {
            clearTimeout(timers[e].id);
            delete timers[e];
          }
          if (!r) {
            return 0;
          }
          var t = setTimeout(() => {
            delete timers[e];
            callUserCallback(() => __emscripten_timeout(e, _emscripten_get_now()));
          }, r);
          timers[e] = {
            id: t,
            timeout_ms: r
          };
          return 0;
        };
        __setitimer_js.sig = "iid";
        var __timegm_js = function (e) {
          var r = (() => {
            var t = Date.UTC(HEAP32[e + 20 >> 2] + 1900, HEAP32[e + 16 >> 2], HEAP32[e + 12 >> 2], HEAP32[e + 8 >> 2], HEAP32[e + 4 >> 2], HEAP32[e >> 2], 0);
            var n = new Date(t);
            HEAP32[e + 24 >> 2] = n.getUTCDay();
            var a = Date.UTC(n.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
            var o = (n.getTime() - a) / 86400000 | 0;
            HEAP32[e + 28 >> 2] = o;
            return n.getTime() / 1000;
          })();
          return BigInt(r);
        };
        __timegm_js.sig = "jp";
        var __tzset_js = (e, r, t, n) => {
          var a = new Date().getFullYear();
          var o = new Date(a, 0, 1);
          var l = new Date(a, 6, 1);
          var c = o.getTimezoneOffset();
          var _ = l.getTimezoneOffset();
          var u = Math.max(c, _);
          HEAPU32[e >> 2] = u * 60;
          HEAP32[r >> 2] = +(c != _);
          var m = g => {
            var h = g >= 0 ? "-" : "+";
            var p = Math.abs(g);
            var b = String(Math.floor(p / 60)).padStart(2, "0");
            var S = String(p % 60).padStart(2, "0");
            return `UTC${h}${b}${S}`;
          };
          var f = m(c);
          var v = m(_);
          if (_ < c) {
            stringToUTF8(f, t, 17);
            stringToUTF8(v, n, 17);
          } else {
            stringToUTF8(f, n, 17);
            stringToUTF8(v, t, 17);
          }
        };
        __tzset_js.sig = "vpppp";
        var _emscripten_set_main_loop_timing = (e, r) => {
          MainLoop.timingMode = e;
          MainLoop.timingValue = r;
          if (!MainLoop.func) {
            return 1;
          }
          MainLoop.running ||= true;
          if (e == 0) {
            MainLoop.scheduler = function () {
              var l = Math.max(0, MainLoop.tickStartTime + r - _emscripten_get_now()) | 0;
              setTimeout(MainLoop.runner, l);
            };
            MainLoop.method = "timeout";
          } else if (e == 1) {
            MainLoop.scheduler = function () {
              MainLoop.requestAnimationFrame(MainLoop.runner);
            };
            MainLoop.method = "rAF";
          } else if (e == 2) {
            if (!MainLoop.setImmediate) {
              if (globalThis.setImmediate) {
                MainLoop.setImmediate = setImmediate;
              } else {
                var t = [];
                var n = "setimmediate";
                var a = o => {
                  if (o.data === n || o.data.target === n) {
                    o.stopPropagation();
                    t.shift()();
                  }
                };
                addEventListener("message", a, true);
                MainLoop.setImmediate = o => {
                  t.push(o);
                  if (ENVIRONMENT_IS_WORKER) {
                    Module.setImmediates ??= [];
                    Module.setImmediates.push(o);
                    postMessage({
                      target: n
                    });
                  } else {
                    postMessage(n, "*");
                  }
                };
              }
            }
            MainLoop.scheduler = function () {
              MainLoop.setImmediate(MainLoop.runner);
            };
            MainLoop.method = "immediate";
          }
          return 0;
        };
        _emscripten_set_main_loop_timing.sig = "iii";
        var setMainLoop = (e, r, t, n, a) => {
          MainLoop.func = e;
          MainLoop.arg = n;
          var o = MainLoop.currentlyRunningMainloop;
          function l() {
            if (o < MainLoop.currentlyRunningMainloop) {
              maybeExit();
              return false;
            } else {
              return true;
            }
          }
          MainLoop.running = false;
          MainLoop.runner = function () {
            if (!ABORT) {
              if (MainLoop.queue.length > 0) {
                var _ = Date.now();
                var u = MainLoop.queue.shift();
                u.func(u.arg);
                if (MainLoop.remainingBlockers) {
                  var m = MainLoop.remainingBlockers;
                  var f = m % 1 == 0 ? m - 1 : Math.floor(m);
                  if (u.counted) {
                    MainLoop.remainingBlockers = f;
                  } else {
                    f = f + 0.5;
                    MainLoop.remainingBlockers = (m * 8 + f) / 9;
                  }
                }
                MainLoop.updateStatus();
                if (!l()) {
                  return;
                }
                setTimeout(MainLoop.runner, 0);
                return;
              }
              if (l()) {
                MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
                if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
                  MainLoop.scheduler();
                  return;
                } else if (MainLoop.timingMode == 0) {
                  MainLoop.tickStartTime = _emscripten_get_now();
                }
                MainLoop.runIter(e);
                if (l()) {
                  MainLoop.scheduler();
                }
              }
            }
          };
          if (!a) {
            if (r > 0) {
              _emscripten_set_main_loop_timing(0, 1000 / r);
            } else {
              _emscripten_set_main_loop_timing(1, 1);
            }
            MainLoop.scheduler();
          }
          if (t) {
            throw "unwind";
          }
        };
        var MainLoop = {
          running: false,
          scheduler: null,
          method: "",
          currentlyRunningMainloop: 0,
          func: null,
          arg: 0,
          timingMode: 0,
          timingValue: 0,
          currentFrameNumber: 0,
          queue: [],
          preMainLoop: [],
          postMainLoop: [],
          pause() {
            MainLoop.scheduler = null;
            MainLoop.currentlyRunningMainloop++;
          },
          resume() {
            MainLoop.currentlyRunningMainloop++;
            var e = MainLoop.timingMode;
            var r = MainLoop.timingValue;
            var t = MainLoop.func;
            MainLoop.func = null;
            setMainLoop(t, 0, false, MainLoop.arg, true);
            _emscripten_set_main_loop_timing(e, r);
            MainLoop.scheduler();
          },
          updateStatus() {
            if (Module.setStatus) {
              var e = Module.statusMessage || "Please wait...";
              var r = MainLoop.remainingBlockers ?? 0;
              var t = MainLoop.expectedBlockers ?? 0;
              if (r) {
                if (r < t) {
                  Module.setStatus("{message} ({expected - remaining}/{expected})");
                } else {
                  Module.setStatus(e);
                }
              } else {
                Module.setStatus("");
              }
            }
          },
          init() {
            if (Module.preMainLoop) {
              MainLoop.preMainLoop.push(Module.preMainLoop);
            }
            if (Module.postMainLoop) {
              MainLoop.postMainLoop.push(Module.postMainLoop);
            }
          },
          runIter(e) {
            if (!ABORT) {
              for (var r of MainLoop.preMainLoop) {
                if (r() === false) {
                  return;
                }
              }
              callUserCallback(e);
              for (var t of MainLoop.postMainLoop) {
                t();
              }
            }
          },
          nextRAF: 0,
          fakeRequestAnimationFrame(e) {
            var r = Date.now();
            if (MainLoop.nextRAF === 0) {
              MainLoop.nextRAF = r + 1000 / 60;
            } else {
              while (r + 2 >= MainLoop.nextRAF) {
                MainLoop.nextRAF += 1000 / 60;
              }
            }
            var t = Math.max(MainLoop.nextRAF - r, 0);
            setTimeout(e, t);
          },
          requestAnimationFrame(e) {
            if (globalThis.requestAnimationFrame) {
              requestAnimationFrame(e);
            } else {
              MainLoop.fakeRequestAnimationFrame(e);
            }
          }
        };
        var AL = {
          QUEUE_INTERVAL: 25,
          QUEUE_LOOKAHEAD: 0.1,
          DEVICE_NAME: "Emscripten OpenAL",
          CAPTURE_DEVICE_NAME: "Emscripten OpenAL capture",
          ALC_EXTENSIONS: {
            ALC_EXT_capture: true,
            ALC_SOFT_pause_device: true,
            ALC_SOFT_HRTF: true
          },
          AL_EXTENSIONS: {
            AL_EXT_float32: true,
            AL_SOFT_loop_points: true,
            AL_SOFT_source_length: true,
            AL_EXT_source_distance_model: true,
            AL_SOFT_source_spatialize: true
          },
          _alcErr: 0,
          alcErr: 0,
          deviceRefCounts: {},
          alcStringCache: {},
          paused: false,
          stringCache: {},
          contexts: {},
          currentCtx: null,
          buffers: {
            0: {
              id: 0,
              refCount: 0,
              audioBuf: null,
              frequency: 0,
              bytesPerSample: 2,
              channels: 1,
              length: 0
            }
          },
          paramArray: [],
          _nextId: 1,
          newId: () => AL.freeIds.length > 0 ? AL.freeIds.pop() : AL._nextId++,
          freeIds: [],
          scheduleContextAudio: e => {
            if (MainLoop.timingMode !== 1 || document.visibilityState == "visible") {
              for (var r in e.sources) {
                AL.scheduleSourceAudio(e.sources[r]);
              }
            }
          },
          scheduleSourceAudio: (e, r) => {
            if ((MainLoop.timingMode !== 1 || document.visibilityState == "visible") && e.state === 4114) {
              var t = AL.updateSourceTime(e);
              var n = e.bufStartTime;
              var a = e.bufOffset;
              var o = e.bufsProcessed;
              for (var l = 0; l < e.audioQueue.length; l++) {
                var c = e.audioQueue[l];
                n = c._startTime + c._duration;
                a = 0;
                o += c._skipCount + 1;
              }
              r ||= AL.QUEUE_LOOKAHEAD;
              for (var _ = t + r, u = 0; n < _;) {
                if (o >= e.bufQueue.length) {
                  if (e.looping) {
                    o %= e.bufQueue.length;
                  } else {
                    break;
                  }
                }
                var m = e.bufQueue[o % e.bufQueue.length];
                if (m.length === 0) {
                  u++;
                  if (u === e.bufQueue.length) {
                    break;
                  }
                } else {
                  var c = e.context.audioCtx.createBufferSource();
                  c.buffer = m.audioBuf;
                  c.playbackRate.value = e.playbackRate;
                  if (m.audioBuf._loopStart || m.audioBuf._loopEnd) {
                    c.loopStart = m.audioBuf._loopStart;
                    c.loopEnd = m.audioBuf._loopEnd;
                  }
                  var f = 0;
                  if (e.type === 4136 && e.looping) {
                    f = Number.POSITIVE_INFINITY;
                    c.loop = true;
                    if (m.audioBuf._loopStart) {
                      c.loopStart = m.audioBuf._loopStart;
                    }
                    if (m.audioBuf._loopEnd) {
                      c.loopEnd = m.audioBuf._loopEnd;
                    }
                  } else {
                    f = (m.audioBuf.duration - a) / e.playbackRate;
                  }
                  c._startOffset = a;
                  c._duration = f;
                  c._skipCount = u;
                  u = 0;
                  c.connect(e.gain);
                  if (typeof c.start !== "undefined") {
                    n = Math.max(n, e.context.audioCtx.currentTime);
                    c.start(n, a);
                  } else if (typeof c.noteOn !== "undefined") {
                    n = Math.max(n, e.context.audioCtx.currentTime);
                    c.noteOn(n);
                  }
                  c._startTime = n;
                  e.audioQueue.push(c);
                  n += f;
                }
                a = 0;
                o++;
              }
            }
          },
          updateSourceTime: e => {
            var r = e.context.audioCtx.currentTime;
            if (e.state !== 4114) {
              return r;
            }
            if (!isFinite(e.bufStartTime)) {
              e.bufStartTime = r - e.bufOffset / e.playbackRate;
              e.bufOffset = 0;
            }
            var t = 0;
            for (; e.audioQueue.length;) {
              var n = e.audioQueue[0];
              e.bufsProcessed += n._skipCount;
              t = n._startTime + n._duration;
              if (r < t) {
                break;
              }
              e.audioQueue.shift();
              e.bufStartTime = t;
              e.bufOffset = 0;
              e.bufsProcessed++;
            }
            if (e.bufsProcessed >= e.bufQueue.length && !e.looping) {
              AL.setSourceState(e, 4116);
            } else if (e.type === 4136 && e.looping) {
              var a = e.bufQueue[0];
              if (a.length === 0) {
                e.bufOffset = 0;
              } else {
                var o = (r - e.bufStartTime) * e.playbackRate;
                var l = a.audioBuf._loopStart || 0;
                var c = a.audioBuf._loopEnd || a.audioBuf.duration;
                if (c <= l) {
                  c = a.audioBuf.duration;
                }
                if (o < c) {
                  e.bufOffset = o;
                } else {
                  e.bufOffset = l + (o - l) % (c - l);
                }
              }
            } else if (e.audioQueue[0]) {
              e.bufOffset = (r - e.audioQueue[0]._startTime) * e.playbackRate;
            } else {
              if (e.type !== 4136 && e.looping) {
                var _ = AL.sourceDuration(e) / e.playbackRate;
                if (_ > 0) {
                  e.bufStartTime += Math.floor((r - e.bufStartTime) / _) * _;
                }
              }
              for (var u = 0; u < e.bufQueue.length; u++) {
                if (e.bufsProcessed >= e.bufQueue.length) {
                  if (e.looping) {
                    e.bufsProcessed %= e.bufQueue.length;
                  } else {
                    AL.setSourceState(e, 4116);
                    break;
                  }
                }
                var a = e.bufQueue[e.bufsProcessed];
                if (a.length > 0) {
                  t = e.bufStartTime + a.audioBuf.duration / e.playbackRate;
                  if (r < t) {
                    e.bufOffset = (r - e.bufStartTime) * e.playbackRate;
                    break;
                  }
                  e.bufStartTime = t;
                }
                e.bufOffset = 0;
                e.bufsProcessed++;
              }
            }
            return r;
          },
          cancelPendingSourceAudio: e => {
            AL.updateSourceTime(e);
            for (var r = 1; r < e.audioQueue.length; r++) {
              var t = e.audioQueue[r];
              t.stop();
            }
            if (e.audioQueue.length > 1) {
              e.audioQueue.length = 1;
            }
          },
          stopSourceAudio: e => {
            for (var r = 0; r < e.audioQueue.length; r++) {
              e.audioQueue[r].stop();
            }
            e.audioQueue.length = 0;
          },
          setSourceState: (e, r) => {
            if (r === 4114) {
              if (e.state === 4114 || e.state == 4116) {
                e.bufsProcessed = 0;
                e.bufOffset = 0;
              }
              AL.stopSourceAudio(e);
              e.state = 4114;
              e.bufStartTime = Number.NEGATIVE_INFINITY;
              AL.scheduleSourceAudio(e);
            } else if (r === 4115) {
              if (e.state === 4114) {
                AL.updateSourceTime(e);
                AL.stopSourceAudio(e);
                e.state = 4115;
              }
            } else if (r === 4116) {
              if (e.state !== 4113) {
                e.state = 4116;
                e.bufsProcessed = e.bufQueue.length;
                e.bufStartTime = Number.NEGATIVE_INFINITY;
                e.bufOffset = 0;
                AL.stopSourceAudio(e);
              }
            } else if (r === 4113 && e.state !== 4113) {
              e.state = 4113;
              e.bufsProcessed = 0;
              e.bufStartTime = Number.NEGATIVE_INFINITY;
              e.bufOffset = 0;
              AL.stopSourceAudio(e);
            }
          },
          initSourcePanner: e => {
            if (e.type !== 4144) {
              var r = AL.buffers[0];
              for (var t = 0; t < e.bufQueue.length; t++) {
                if (e.bufQueue[t].id !== 0) {
                  r = e.bufQueue[t];
                  break;
                }
              }
              if (e.spatialize === 1 || e.spatialize === 2 && r.channels === 1) {
                if (e.panner) {
                  return;
                }
                e.panner = e.context.audioCtx.createPanner();
                AL.updateSourceGlobal(e);
                AL.updateSourceSpace(e);
                e.panner.connect(e.context.gain);
                e.gain.disconnect();
                e.gain.connect(e.panner);
              } else {
                if (!e.panner) {
                  return;
                }
                e.panner.disconnect();
                e.gain.disconnect();
                e.gain.connect(e.context.gain);
                e.panner = null;
              }
            }
          },
          updateContextGlobal: e => {
            for (var r in e.sources) {
              AL.updateSourceGlobal(e.sources[r]);
            }
          },
          updateSourceGlobal: e => {
            var r = e.panner;
            if (r) {
              r.refDistance = e.refDistance;
              r.maxDistance = e.maxDistance;
              r.rolloffFactor = e.rolloffFactor;
              r.panningModel = e.context.hrtf ? "HRTF" : "equalpower";
              var t = e.context.sourceDistanceModel ? e.distanceModel : e.context.distanceModel;
              switch (t) {
                case 0:
                  r.distanceModel = "inverse";
                  r.refDistance = 3.40282e+38;
                  break;
                case 53249:
                case 53250:
                  r.distanceModel = "inverse";
                  break;
                case 53251:
                case 53252:
                  r.distanceModel = "linear";
                  break;
                case 53253:
                case 53254:
                  r.distanceModel = "exponential";
                  break;
              }
            }
          },
          updateListenerSpace: e => {
            var r = e.audioCtx.listener;
            if (r.positionX) {
              r.positionX.value = e.listener.position[0];
              r.positionY.value = e.listener.position[1];
              r.positionZ.value = e.listener.position[2];
            } else {
              r.setPosition(e.listener.position[0], e.listener.position[1], e.listener.position[2]);
            }
            if (r.forwardX) {
              r.forwardX.value = e.listener.direction[0];
              r.forwardY.value = e.listener.direction[1];
              r.forwardZ.value = e.listener.direction[2];
              r.upX.value = e.listener.up[0];
              r.upY.value = e.listener.up[1];
              r.upZ.value = e.listener.up[2];
            } else {
              r.setOrientation(e.listener.direction[0], e.listener.direction[1], e.listener.direction[2], e.listener.up[0], e.listener.up[1], e.listener.up[2]);
            }
            for (var t in e.sources) {
              AL.updateSourceSpace(e.sources[t]);
            }
          },
          updateSourceSpace: e => {
            if (e.panner) {
              var r = e.panner;
              var t = e.position[0];
              var n = e.position[1];
              var a = e.position[2];
              var o = e.direction[0];
              var l = e.direction[1];
              var c = e.direction[2];
              var _ = e.context.listener;
              var u = _.position[0];
              var m = _.position[1];
              var f = _.position[2];
              if (e.relative) {
                var v = -_.direction[0];
                var g = -_.direction[1];
                var h = -_.direction[2];
                var p = _.up[0];
                var b = _.up[1];
                var S = _.up[2];
                var w = (ce, re, ne) => {
                  var se = Math.sqrt(ce * ce + re * re + ne * ne);
                  if (se < Number.EPSILON) {
                    return 0;
                  } else {
                    return 1 / se;
                  }
                };
                var A = w(v, g, h);
                v *= A;
                g *= A;
                h *= A;
                A = w(p, b, S);
                p *= A;
                b *= A;
                S *= A;
                var k = b * h - S * g;
                var G = S * v - p * h;
                var D = p * g - b * v;
                A = w(k, G, D);
                k *= A;
                G *= A;
                D *= A;
                p = g * D - h * G;
                b = h * k - v * D;
                S = v * G - g * k;
                var F = o;
                var H = l;
                var z = c;
                o = F * k + H * p + z * v;
                l = F * G + H * b + z * g;
                c = F * D + H * S + z * h;
                F = t;
                H = n;
                z = a;
                t = F * k + H * p + z * v;
                n = F * G + H * b + z * g;
                a = F * D + H * S + z * h;
                t += u;
                n += m;
                a += f;
              }
              if (r.positionX) {
                if (t != r.positionX.value) {
                  r.positionX.value = t;
                }
                if (n != r.positionY.value) {
                  r.positionY.value = n;
                }
                if (a != r.positionZ.value) {
                  r.positionZ.value = a;
                }
              } else {
                r.setPosition(t, n, a);
              }
              if (r.orientationX) {
                if (o != r.orientationX.value) {
                  r.orientationX.value = o;
                }
                if (l != r.orientationY.value) {
                  r.orientationY.value = l;
                }
                if (c != r.orientationZ.value) {
                  r.orientationZ.value = c;
                }
              } else {
                r.setOrientation(o, l, c);
              }
              var x = e.dopplerShift;
              var I = e.velocity[0];
              var E = e.velocity[1];
              var M = e.velocity[2];
              var Z = _.velocity[0];
              var N = _.velocity[1];
              var $ = _.velocity[2];
              if (t === u && n === m && a === f || I === Z && E === N && M === $) {
                e.dopplerShift = 1;
              } else {
                var O = e.context.speedOfSound;
                var J = e.context.dopplerFactor;
                var B = u - t;
                var T = m - n;
                var K = f - a;
                var q = Math.sqrt(B * B + T * T + K * K);
                var X = (B * Z + T * N + K * $) / q;
                var ae = (B * I + T * E + K * M) / q;
                X = Math.min(X, O / J);
                ae = Math.min(ae, O / J);
                e.dopplerShift = (O - J * X) / (O - J * ae);
              }
              if (e.dopplerShift !== x) {
                AL.updateSourceRate(e);
              }
            }
          },
          updateSourceRate: e => {
            if (e.state === 4114) {
              AL.cancelPendingSourceAudio(e);
              var r = e.audioQueue[0];
              if (!r) {
                return;
              }
              var t;
              if (e.type === 4136 && e.looping) {
                t = Number.POSITIVE_INFINITY;
              } else {
                t = (r.buffer.duration - r._startOffset) / e.playbackRate;
              }
              r._duration = t;
              r.playbackRate.value = e.playbackRate;
              AL.scheduleSourceAudio(e);
            }
          },
          sourceDuration: e => {
            var r = 0;
            for (var t = 0; t < e.bufQueue.length; t++) {
              var n = e.bufQueue[t].audioBuf;
              r += n ? n.duration : 0;
            }
            return r;
          },
          sourceTell: e => {
            AL.updateSourceTime(e);
            var r = 0;
            for (var t = 0; t < e.bufsProcessed; t++) {
              if (e.bufQueue[t].audioBuf) {
                r += e.bufQueue[t].audioBuf.duration;
              }
            }
            r += e.bufOffset;
            return r;
          },
          sourceSeek: (e, r) => {
            var t = e.state == 4114;
            if (t) {
              AL.setSourceState(e, 4113);
            }
            if (e.bufQueue[e.bufsProcessed].audioBuf !== null) {
              for (e.bufsProcessed = 0; r > e.bufQueue[e.bufsProcessed].audioBuf.duration;) {
                r -= e.bufQueue[e.bufsProcessed].audioBuf.duration;
                e.bufsProcessed++;
              }
              e.bufOffset = r;
            }
            if (t) {
              AL.setSourceState(e, 4114);
            }
          },
          getGlobalParam: (e, r) => {
            if (!AL.currentCtx) {
              return null;
            }
            switch (r) {
              case 49152:
                return AL.currentCtx.dopplerFactor;
              case 49155:
                return AL.currentCtx.speedOfSound;
              case 53248:
                return AL.currentCtx.distanceModel;
              default:
                AL.currentCtx.err = 40962;
                return null;
            }
          },
          setGlobalParam: (e, r, t) => {
            if (AL.currentCtx) {
              switch (r) {
                case 49152:
                  if (!Number.isFinite(t) || t < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.currentCtx.dopplerFactor = t;
                  AL.updateListenerSpace(AL.currentCtx);
                  break;
                case 49155:
                  if (!Number.isFinite(t) || t <= 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.currentCtx.speedOfSound = t;
                  AL.updateListenerSpace(AL.currentCtx);
                  break;
                case 53248:
                  switch (t) {
                    case 0:
                    case 53249:
                    case 53250:
                    case 53251:
                    case 53252:
                    case 53253:
                    case 53254:
                      AL.currentCtx.distanceModel = t;
                      AL.updateContextGlobal(AL.currentCtx);
                      break;
                    default:
                      AL.currentCtx.err = 40963;
                      return;
                  }
                  break;
                default:
                  AL.currentCtx.err = 40962;
                  return;
              }
            }
          },
          getListenerParam: (e, r) => {
            if (!AL.currentCtx) {
              return null;
            }
            switch (r) {
              case 4100:
                return AL.currentCtx.listener.position;
              case 4102:
                return AL.currentCtx.listener.velocity;
              case 4111:
                return AL.currentCtx.listener.direction.concat(AL.currentCtx.listener.up);
              case 4106:
                return AL.currentCtx.gain.gain.value;
              default:
                AL.currentCtx.err = 40962;
                return null;
            }
          },
          setListenerParam: (e, r, t) => {
            if (AL.currentCtx) {
              if (t === null) {
                AL.currentCtx.err = 40962;
                return;
              }
              var n = AL.currentCtx.listener;
              switch (r) {
                case 4100:
                  if (!Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(t[2])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  n.position[0] = t[0];
                  n.position[1] = t[1];
                  n.position[2] = t[2];
                  AL.updateListenerSpace(AL.currentCtx);
                  break;
                case 4102:
                  if (!Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(t[2])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  n.velocity[0] = t[0];
                  n.velocity[1] = t[1];
                  n.velocity[2] = t[2];
                  AL.updateListenerSpace(AL.currentCtx);
                  break;
                case 4106:
                  if (!Number.isFinite(t) || t < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.currentCtx.gain.gain.value = t;
                  break;
                case 4111:
                  if (!Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(t[2]) || !Number.isFinite(t[3]) || !Number.isFinite(t[4]) || !Number.isFinite(t[5])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  n.direction[0] = t[0];
                  n.direction[1] = t[1];
                  n.direction[2] = t[2];
                  n.up[0] = t[3];
                  n.up[1] = t[4];
                  n.up[2] = t[5];
                  AL.updateListenerSpace(AL.currentCtx);
                  break;
                default:
                  AL.currentCtx.err = 40962;
                  return;
              }
            }
          },
          getBufferParam: (e, r, t) => {
            if (AL.currentCtx) {
              var n = AL.buffers[r];
              if (!n || r === 0) {
                AL.currentCtx.err = 40961;
                return;
              }
              switch (t) {
                case 8193:
                  return n.frequency;
                case 8194:
                  return n.bytesPerSample * 8;
                case 8195:
                  return n.channels;
                case 8196:
                  return n.length * n.bytesPerSample * n.channels;
                case 8213:
                  if (n.length === 0) {
                    return [0, 0];
                  } else {
                    return [(n.audioBuf._loopStart || 0) * n.frequency, (n.audioBuf._loopEnd || n.length) * n.frequency];
                  }
                default:
                  AL.currentCtx.err = 40962;
                  return null;
              }
            }
          },
          setBufferParam: (e, r, t, n) => {
            if (AL.currentCtx) {
              var a = AL.buffers[r];
              if (!a || r === 0) {
                AL.currentCtx.err = 40961;
                return;
              }
              if (n === null) {
                AL.currentCtx.err = 40962;
                return;
              }
              switch (t) {
                case 8196:
                  if (n !== 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  break;
                case 8213:
                  if (n[0] < 0 || n[0] > a.length || n[1] < 0 || n[1] > a.Length || n[0] >= n[1]) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  if (a.refCount > 0) {
                    AL.currentCtx.err = 40964;
                    return;
                  }
                  if (a.audioBuf) {
                    a.audioBuf._loopStart = n[0] / a.frequency;
                    a.audioBuf._loopEnd = n[1] / a.frequency;
                  }
                  break;
                default:
                  AL.currentCtx.err = 40962;
                  return;
              }
            }
          },
          getSourceParam: (e, r, t) => {
            if (!AL.currentCtx) {
              return null;
            }
            var n = AL.currentCtx.sources[r];
            if (!n) {
              AL.currentCtx.err = 40961;
              return null;
            }
            switch (t) {
              case 514:
                return n.relative;
              case 4097:
                return n.coneInnerAngle;
              case 4098:
                return n.coneOuterAngle;
              case 4099:
                return n.pitch;
              case 4100:
                return n.position;
              case 4101:
                return n.direction;
              case 4102:
                return n.velocity;
              case 4103:
                return n.looping;
              case 4105:
                if (n.type === 4136) {
                  return n.bufQueue[0].id;
                } else {
                  return 0;
                }
              case 4106:
                return n.gain.gain.value;
              case 4109:
                return n.minGain;
              case 4110:
                return n.maxGain;
              case 4112:
                return n.state;
              case 4117:
                if (n.bufQueue.length === 1 && n.bufQueue[0].id === 0) {
                  return 0;
                } else {
                  return n.bufQueue.length;
                }
              case 4118:
                if (n.bufQueue.length === 1 && n.bufQueue[0].id === 0 || n.looping) {
                  return 0;
                } else {
                  return n.bufsProcessed;
                }
              case 4128:
                return n.refDistance;
              case 4129:
                return n.rolloffFactor;
              case 4130:
                return n.coneOuterGain;
              case 4131:
                return n.maxDistance;
              case 4132:
                return AL.sourceTell(n);
              case 4133:
                var a = AL.sourceTell(n);
                if (a > 0) {
                  a *= n.bufQueue[0].frequency;
                }
                return a;
              case 4134:
                var a = AL.sourceTell(n);
                if (a > 0) {
                  a *= n.bufQueue[0].frequency * n.bufQueue[0].bytesPerSample;
                }
                return a;
              case 4135:
                return n.type;
              case 4628:
                return n.spatialize;
              case 8201:
                var c = 0;
                var o = 0;
                for (var l = 0; l < n.bufQueue.length; l++) {
                  c += n.bufQueue[l].length;
                  if (n.bufQueue[l].id !== 0) {
                    o = n.bufQueue[l].bytesPerSample * n.bufQueue[l].channels;
                  }
                }
                return c * o;
              case 8202:
                var c = 0;
                for (var l = 0; l < n.bufQueue.length; l++) {
                  c += n.bufQueue[l].length;
                }
                return c;
              case 8203:
                return AL.sourceDuration(n);
              case 53248:
                return n.distanceModel;
              default:
                AL.currentCtx.err = 40962;
                return null;
            }
          },
          setSourceParam: (e, r, t, n) => {
            if (AL.currentCtx) {
              var a = AL.currentCtx.sources[r];
              if (!a) {
                AL.currentCtx.err = 40961;
                return;
              }
              if (n === null) {
                AL.currentCtx.err = 40962;
                return;
              }
              switch (t) {
                case 514:
                  if (n === 1) {
                    a.relative = true;
                    AL.updateSourceSpace(a);
                  } else if (n === 0) {
                    a.relative = false;
                    AL.updateSourceSpace(a);
                  } else {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  break;
                case 4097:
                  if (!Number.isFinite(n)) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.coneInnerAngle = n;
                  if (a.panner) {
                    a.panner.coneInnerAngle = n % 360;
                  }
                  break;
                case 4098:
                  if (!Number.isFinite(n)) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.coneOuterAngle = n;
                  if (a.panner) {
                    a.panner.coneOuterAngle = n % 360;
                  }
                  break;
                case 4099:
                  if (!Number.isFinite(n) || n <= 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  if (a.pitch === n) {
                    break;
                  }
                  a.pitch = n;
                  AL.updateSourceRate(a);
                  break;
                case 4100:
                  if (!Number.isFinite(n[0]) || !Number.isFinite(n[1]) || !Number.isFinite(n[2])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.position[0] = n[0];
                  a.position[1] = n[1];
                  a.position[2] = n[2];
                  AL.updateSourceSpace(a);
                  break;
                case 4101:
                  if (!Number.isFinite(n[0]) || !Number.isFinite(n[1]) || !Number.isFinite(n[2])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.direction[0] = n[0];
                  a.direction[1] = n[1];
                  a.direction[2] = n[2];
                  AL.updateSourceSpace(a);
                  break;
                case 4102:
                  if (!Number.isFinite(n[0]) || !Number.isFinite(n[1]) || !Number.isFinite(n[2])) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.velocity[0] = n[0];
                  a.velocity[1] = n[1];
                  a.velocity[2] = n[2];
                  AL.updateSourceSpace(a);
                  break;
                case 4103:
                  if (n === 1) {
                    a.looping = true;
                    AL.updateSourceTime(a);
                    if (a.type === 4136 && a.audioQueue.length > 0) {
                      var o = a.audioQueue[0];
                      o.loop = true;
                      o._duration = Number.POSITIVE_INFINITY;
                    }
                  } else if (n === 0) {
                    a.looping = false;
                    var l = AL.updateSourceTime(a);
                    if (a.type === 4136 && a.audioQueue.length > 0) {
                      var o = a.audioQueue[0];
                      o.loop = false;
                      o._duration = a.bufQueue[0].audioBuf.duration / a.playbackRate;
                      o._startTime = l - a.bufOffset / a.playbackRate;
                    }
                  } else {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  break;
                case 4105:
                  if (a.state === 4114 || a.state === 4115) {
                    AL.currentCtx.err = 40964;
                    return;
                  }
                  if (n === 0) {
                    for (var c in a.bufQueue) {
                      a.bufQueue[c].refCount--;
                    }
                    a.bufQueue.length = 1;
                    a.bufQueue[0] = AL.buffers[0];
                    a.bufsProcessed = 0;
                    a.type = 4144;
                  } else {
                    var _ = AL.buffers[n];
                    if (!_) {
                      AL.currentCtx.err = 40963;
                      return;
                    }
                    for (var c in a.bufQueue) {
                      a.bufQueue[c].refCount--;
                    }
                    a.bufQueue.length = 0;
                    _.refCount++;
                    a.bufQueue = [_];
                    a.bufsProcessed = 0;
                    a.type = 4136;
                  }
                  AL.initSourcePanner(a);
                  AL.scheduleSourceAudio(a);
                  break;
                case 4106:
                  if (!Number.isFinite(n) || n < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.gain.gain.value = n;
                  break;
                case 4109:
                  if (!Number.isFinite(n) || n < 0 || n > Math.min(a.maxGain, 1)) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.minGain = n;
                  break;
                case 4110:
                  if (!Number.isFinite(n) || n < Math.max(0, a.minGain) || n > 1) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.maxGain = n;
                  break;
                case 4128:
                  if (!Number.isFinite(n) || n < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.refDistance = n;
                  if (a.panner) {
                    a.panner.refDistance = n;
                  }
                  break;
                case 4129:
                  if (!Number.isFinite(n) || n < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.rolloffFactor = n;
                  if (a.panner) {
                    a.panner.rolloffFactor = n;
                  }
                  break;
                case 4130:
                  if (!Number.isFinite(n) || n < 0 || n > 1) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.coneOuterGain = n;
                  if (a.panner) {
                    a.panner.coneOuterGain = n;
                  }
                  break;
                case 4131:
                  if (!Number.isFinite(n) || n < 0) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.maxDistance = n;
                  if (a.panner) {
                    a.panner.maxDistance = n;
                  }
                  break;
                case 4132:
                  if (n < 0 || n > AL.sourceDuration(a)) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.sourceSeek(a, n);
                  break;
                case 4133:
                  var f = AL.sourceDuration(a);
                  if (f > 0) {
                    var u;
                    for (var m in a.bufQueue) {
                      if (m) {
                        u = a.bufQueue[m].frequency;
                        break;
                      }
                    }
                    n /= u;
                  }
                  if (n < 0 || n > f) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.sourceSeek(a, n);
                  break;
                case 4134:
                  var f = AL.sourceDuration(a);
                  if (f > 0) {
                    var v;
                    for (var m in a.bufQueue) {
                      if (m) {
                        var _ = a.bufQueue[m];
                        v = _.frequency * _.bytesPerSample * _.channels;
                        break;
                      }
                    }
                    n /= v;
                  }
                  if (n < 0 || n > f) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  AL.sourceSeek(a, n);
                  break;
                case 4628:
                  if (n !== 0 && n !== 1 && n !== 2) {
                    AL.currentCtx.err = 40963;
                    return;
                  }
                  a.spatialize = n;
                  AL.initSourcePanner(a);
                  break;
                case 8201:
                case 8202:
                case 8203:
                  AL.currentCtx.err = 40964;
                  break;
                case 53248:
                  switch (n) {
                    case 0:
                    case 53249:
                    case 53250:
                    case 53251:
                    case 53252:
                    case 53253:
                    case 53254:
                      a.distanceModel = n;
                      if (AL.currentCtx.sourceDistanceModel) {
                        AL.updateContextGlobal(AL.currentCtx);
                      }
                      break;
                    default:
                      AL.currentCtx.err = 40963;
                      return;
                  }
                  break;
                default:
                  AL.currentCtx.err = 40962;
                  return;
              }
            }
          },
          captures: {},
          sharedCaptureAudioCtx: null,
          requireValidCaptureDevice: (e, r) => {
            if (e === 0) {
              AL.alcErr = 40961;
              return null;
            }
            var t = AL.captures[e];
            if (!t) {
              AL.alcErr = 40961;
              return null;
            }
            var n = t.mediaStreamError;
            if (n) {
              AL.alcErr = 40961;
              return null;
            } else {
              return t;
            }
          }
        };
        var _alBuffer3f = (e, r, t, n, a) => {
          AL.setBufferParam("alBuffer3f", e, r, null);
        };
        _alBuffer3f.sig = "viifff";
        var _alBuffer3i = (e, r, t, n, a) => {
          AL.setBufferParam("alBuffer3i", e, r, null);
        };
        _alBuffer3i.sig = "viiiii";
        var _alBufferData = (e, r, t, n, a) => {
          if (AL.currentCtx) {
            var o = AL.buffers[e];
            if (!o) {
              AL.currentCtx.err = 40963;
              return;
            }
            if (a <= 0) {
              AL.currentCtx.err = 40963;
              return;
            }
            var l = null;
            try {
              switch (r) {
                case 4352:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(1, n, a);
                    var c = l.getChannelData(0);
                    for (var _ = 0; _ < n; ++_) {
                      c[_] = HEAPU8[t++] * 0.0078125 - 1;
                    }
                  }
                  o.bytesPerSample = 1;
                  o.channels = 1;
                  o.length = n;
                  break;
                case 4353:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(1, n >> 1, a);
                    var c = l.getChannelData(0);
                    t >>= 1;
                    for (var _ = 0; _ < n >> 1; ++_) {
                      c[_] = HEAP16[t++] * 0.000030517578125;
                    }
                  }
                  o.bytesPerSample = 2;
                  o.channels = 1;
                  o.length = n >> 1;
                  break;
                case 4354:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(2, n >> 1, a);
                    var c = l.getChannelData(0);
                    var u = l.getChannelData(1);
                    for (var _ = 0; _ < n >> 1; ++_) {
                      c[_] = HEAPU8[t++] * 0.0078125 - 1;
                      u[_] = HEAPU8[t++] * 0.0078125 - 1;
                    }
                  }
                  o.bytesPerSample = 1;
                  o.channels = 2;
                  o.length = n >> 1;
                  break;
                case 4355:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(2, n >> 2, a);
                    var c = l.getChannelData(0);
                    var u = l.getChannelData(1);
                    t >>= 1;
                    for (var _ = 0; _ < n >> 2; ++_) {
                      c[_] = HEAP16[t++] * 0.000030517578125;
                      u[_] = HEAP16[t++] * 0.000030517578125;
                    }
                  }
                  o.bytesPerSample = 2;
                  o.channels = 2;
                  o.length = n >> 2;
                  break;
                case 65552:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(1, n >> 2, a);
                    var c = l.getChannelData(0);
                    t >>= 2;
                    for (var _ = 0; _ < n >> 2; ++_) {
                      c[_] = HEAPF32[t++];
                    }
                  }
                  o.bytesPerSample = 4;
                  o.channels = 1;
                  o.length = n >> 2;
                  break;
                case 65553:
                  if (n > 0) {
                    l = AL.currentCtx.audioCtx.createBuffer(2, n >> 3, a);
                    var c = l.getChannelData(0);
                    var u = l.getChannelData(1);
                    t >>= 2;
                    for (var _ = 0; _ < n >> 3; ++_) {
                      c[_] = HEAPF32[t++];
                      u[_] = HEAPF32[t++];
                    }
                  }
                  o.bytesPerSample = 4;
                  o.channels = 2;
                  o.length = n >> 3;
                  break;
                default:
                  AL.currentCtx.err = 40963;
                  return;
              }
              o.frequency = a;
              o.audioBuf = l;
            } catch {
              AL.currentCtx.err = 40963;
              return;
            }
          }
        };
        _alBufferData.sig = "viipii";
        var _alBufferf = (e, r, t) => {
          AL.setBufferParam("alBufferf", e, r, null);
        };
        _alBufferf.sig = "viif";
        var _alBufferfv = (e, r, t) => {
          if (AL.currentCtx) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.setBufferParam("alBufferfv", e, r, null);
          }
        };
        _alBufferfv.sig = "viip";
        var _alBufferi = (e, r, t) => {
          AL.setBufferParam("alBufferi", e, r, null);
        };
        _alBufferi.sig = "viii";
        var _alBufferiv = (e, r, t) => {
          if (AL.currentCtx) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            if (r === 8213) {
              AL.paramArray[0] = HEAP32[t >> 2];
              AL.paramArray[1] = HEAP32[t + 4 >> 2];
              AL.setBufferParam("alBufferiv", e, r, AL.paramArray);
            } else {
              AL.setBufferParam("alBufferiv", e, r, null);
            }
          }
        };
        _alBufferiv.sig = "viip";
        var _alDeleteBuffers = (e, r) => {
          if (AL.currentCtx) {
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              if (n !== 0) {
                if (!AL.buffers[n]) {
                  AL.currentCtx.err = 40961;
                  return;
                }
                if (AL.buffers[n].refCount) {
                  AL.currentCtx.err = 40964;
                  return;
                }
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              if (n !== 0) {
                AL.deviceRefCounts[AL.buffers[n].deviceId]--;
                delete AL.buffers[n];
                AL.freeIds.push(n);
              }
            }
          }
        };
        _alDeleteBuffers.sig = "vip";
        var _alSourcei = (e, r, t) => {
          switch (r) {
            case 514:
            case 4097:
            case 4098:
            case 4103:
            case 4105:
            case 4128:
            case 4129:
            case 4131:
            case 4132:
            case 4133:
            case 4134:
            case 4628:
            case 8201:
            case 8202:
            case 53248:
              AL.setSourceParam("alSourcei", e, r, t);
              break;
            default:
              AL.setSourceParam("alSourcei", e, r, null);
              break;
          }
        };
        _alSourcei.sig = "viii";
        var _alDeleteSources = (e, r) => {
          if (AL.currentCtx) {
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              if (!AL.currentCtx.sources[n]) {
                AL.currentCtx.err = 40961;
                return;
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              AL.setSourceState(AL.currentCtx.sources[n], 4116);
              _alSourcei(n, 4105, 0);
              delete AL.currentCtx.sources[n];
              AL.freeIds.push(n);
            }
          }
        };
        _alDeleteSources.sig = "vip";
        var _alDisable = e => {
          if (AL.currentCtx) {
            if (e === 512) {
              AL.currentCtx.sourceDistanceModel = false;
              AL.updateContextGlobal(AL.currentCtx);
            } else {
              AL.currentCtx.err = 40962;
              return;
            }
          }
        };
        _alDisable.sig = "vi";
        var _alDistanceModel = e => {
          AL.setGlobalParam("alDistanceModel", 53248, e);
        };
        _alDistanceModel.sig = "vi";
        var _alDopplerFactor = e => {
          AL.setGlobalParam("alDopplerFactor", 49152, e);
        };
        _alDopplerFactor.sig = "vf";
        var _alDopplerVelocity = e => {
          warnOnce("alDopplerVelocity() is deprecated, and only kept for compatibility with OpenAL 1.0. Use alSpeedOfSound() instead.");
          if (!!AL.currentCtx && e <= 0) {
            AL.currentCtx.err = 40963;
            return;
          }
        };
        _alDopplerVelocity.sig = "vf";
        var _alEnable = e => {
          if (AL.currentCtx) {
            if (e === 512) {
              AL.currentCtx.sourceDistanceModel = true;
              AL.updateContextGlobal(AL.currentCtx);
            } else {
              AL.currentCtx.err = 40962;
              return;
            }
          }
        };
        _alEnable.sig = "vi";
        var _alGenBuffers = (e, r) => {
          if (AL.currentCtx) {
            for (var t = 0; t < e; ++t) {
              var n = {
                deviceId: AL.currentCtx.deviceId,
                id: AL.newId(),
                refCount: 0,
                audioBuf: null,
                frequency: 0,
                bytesPerSample: 2,
                channels: 1,
                length: 0
              };
              AL.deviceRefCounts[n.deviceId]++;
              AL.buffers[n.id] = n;
              HEAP32[r + t * 4 >> 2] = n.id;
            }
          }
        };
        _alGenBuffers.sig = "vip";
        var _alGenSources = (e, r) => {
          if (AL.currentCtx) {
            for (var t = 0; t < e; ++t) {
              var n = AL.currentCtx.audioCtx.createGain();
              n.connect(AL.currentCtx.gain);
              var a = {
                context: AL.currentCtx,
                id: AL.newId(),
                type: 4144,
                state: 4113,
                bufQueue: [AL.buffers[0]],
                audioQueue: [],
                looping: false,
                pitch: 1,
                dopplerShift: 1,
                gain: n,
                minGain: 0,
                maxGain: 1,
                panner: null,
                bufsProcessed: 0,
                bufStartTime: Number.NEGATIVE_INFINITY,
                bufOffset: 0,
                relative: false,
                refDistance: 1,
                maxDistance: 3.40282e+38,
                rolloffFactor: 1,
                position: [0, 0, 0],
                velocity: [0, 0, 0],
                direction: [0, 0, 0],
                coneOuterGain: 0,
                coneInnerAngle: 360,
                coneOuterAngle: 360,
                distanceModel: 53250,
                spatialize: 2,
                get playbackRate() {
                  return this.pitch * this.dopplerShift;
                }
              };
              AL.currentCtx.sources[a.id] = a;
              HEAP32[r + t * 4 >> 2] = a.id;
            }
          }
        };
        _alGenSources.sig = "vip";
        var _alGetBoolean = e => {
          var r = AL.getGlobalParam("alGetBoolean", e);
          if (r === null) {
            return 0;
          }
          switch (e) {
            case 49152:
            case 49155:
            case 53248:
              if (r !== 0) {
                return 1;
              } else {
                return 0;
              }
            default:
              AL.currentCtx.err = 40962;
              return 0;
          }
        };
        _alGetBoolean.sig = "ii";
        var _alGetBooleanv = (e, r) => {
          var t = AL.getGlobalParam("alGetBooleanv", e);
          if (t !== null && !!r) {
            switch (e) {
              case 49152:
              case 49155:
              case 53248:
                HEAP8[r] = t;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetBooleanv.sig = "vip";
        var _alGetBuffer3f = (e, r, t, n, a) => {
          var o = AL.getBufferParam("alGetBuffer3f", e, r);
          if (o !== null) {
            if (!t || !n || !a) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.currentCtx.err = 40962;
          }
        };
        _alGetBuffer3f.sig = "viippp";
        var _alGetBuffer3i = (e, r, t, n, a) => {
          var o = AL.getBufferParam("alGetBuffer3i", e, r);
          if (o !== null) {
            if (!t || !n || !a) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.currentCtx.err = 40962;
          }
        };
        _alGetBuffer3i.sig = "viippp";
        var _alGetBufferf = (e, r, t) => {
          var n = AL.getBufferParam("alGetBufferf", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.currentCtx.err = 40962;
          }
        };
        _alGetBufferf.sig = "viip";
        var _alGetBufferfv = (e, r, t) => {
          var n = AL.getBufferParam("alGetBufferfv", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.currentCtx.err = 40962;
          }
        };
        _alGetBufferfv.sig = "viip";
        var _alGetBufferi = (e, r, t) => {
          var n = AL.getBufferParam("alGetBufferi", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 8193:
              case 8194:
              case 8195:
              case 8196:
                HEAP32[t >> 2] = n;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetBufferi.sig = "viip";
        var _alGetBufferiv = (e, r, t) => {
          var n = AL.getBufferParam("alGetBufferiv", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 8193:
              case 8194:
              case 8195:
              case 8196:
                HEAP32[t >> 2] = n;
                break;
              case 8213:
                HEAP32[t >> 2] = n[0];
                HEAP32[t + 4 >> 2] = n[1];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetBufferiv.sig = "viip";
        var _alGetDouble = e => {
          var r = AL.getGlobalParam("alGetDouble", e);
          if (r === null) {
            return 0;
          }
          switch (e) {
            case 49152:
            case 49155:
            case 53248:
              return r;
            default:
              AL.currentCtx.err = 40962;
              return 0;
          }
        };
        _alGetDouble.sig = "di";
        var _alGetDoublev = (e, r) => {
          var t = AL.getGlobalParam("alGetDoublev", e);
          if (t !== null && !!r) {
            switch (e) {
              case 49152:
              case 49155:
              case 53248:
                HEAPF64[r >> 3] = t;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetDoublev.sig = "vip";
        var _alGetEnumValue = e => {
          if (!AL.currentCtx) {
            return 0;
          }
          if (!e) {
            AL.currentCtx.err = 40963;
            return 0;
          }
          var r = UTF8ToString(e);
          switch (r) {
            case "AL_BITS":
              return 8194;
            case "AL_BUFFER":
              return 4105;
            case "AL_BUFFERS_PROCESSED":
              return 4118;
            case "AL_BUFFERS_QUEUED":
              return 4117;
            case "AL_BYTE_OFFSET":
              return 4134;
            case "AL_CHANNELS":
              return 8195;
            case "AL_CONE_INNER_ANGLE":
              return 4097;
            case "AL_CONE_OUTER_ANGLE":
              return 4098;
            case "AL_CONE_OUTER_GAIN":
              return 4130;
            case "AL_DIRECTION":
              return 4101;
            case "AL_DISTANCE_MODEL":
              return 53248;
            case "AL_DOPPLER_FACTOR":
              return 49152;
            case "AL_DOPPLER_VELOCITY":
              return 49153;
            case "AL_EXPONENT_DISTANCE":
              return 53253;
            case "AL_EXPONENT_DISTANCE_CLAMPED":
              return 53254;
            case "AL_EXTENSIONS":
              return 45060;
            case "AL_FORMAT_MONO16":
              return 4353;
            case "AL_FORMAT_MONO8":
              return 4352;
            case "AL_FORMAT_STEREO16":
              return 4355;
            case "AL_FORMAT_STEREO8":
              return 4354;
            case "AL_FREQUENCY":
              return 8193;
            case "AL_GAIN":
              return 4106;
            case "AL_INITIAL":
              return 4113;
            case "AL_INVALID":
              return -1;
            case "AL_ILLEGAL_ENUM":
            case "AL_INVALID_ENUM":
              return 40962;
            case "AL_INVALID_NAME":
              return 40961;
            case "AL_ILLEGAL_COMMAND":
            case "AL_INVALID_OPERATION":
              return 40964;
            case "AL_INVALID_VALUE":
              return 40963;
            case "AL_INVERSE_DISTANCE":
              return 53249;
            case "AL_INVERSE_DISTANCE_CLAMPED":
              return 53250;
            case "AL_LINEAR_DISTANCE":
              return 53251;
            case "AL_LINEAR_DISTANCE_CLAMPED":
              return 53252;
            case "AL_LOOPING":
              return 4103;
            case "AL_MAX_DISTANCE":
              return 4131;
            case "AL_MAX_GAIN":
              return 4110;
            case "AL_MIN_GAIN":
              return 4109;
            case "AL_NONE":
              return 0;
            case "AL_NO_ERROR":
              return 0;
            case "AL_ORIENTATION":
              return 4111;
            case "AL_OUT_OF_MEMORY":
              return 40965;
            case "AL_PAUSED":
              return 4115;
            case "AL_PENDING":
              return 8209;
            case "AL_PITCH":
              return 4099;
            case "AL_PLAYING":
              return 4114;
            case "AL_POSITION":
              return 4100;
            case "AL_PROCESSED":
              return 8210;
            case "AL_REFERENCE_DISTANCE":
              return 4128;
            case "AL_RENDERER":
              return 45059;
            case "AL_ROLLOFF_FACTOR":
              return 4129;
            case "AL_SAMPLE_OFFSET":
              return 4133;
            case "AL_SEC_OFFSET":
              return 4132;
            case "AL_SIZE":
              return 8196;
            case "AL_SOURCE_RELATIVE":
              return 514;
            case "AL_SOURCE_STATE":
              return 4112;
            case "AL_SOURCE_TYPE":
              return 4135;
            case "AL_SPEED_OF_SOUND":
              return 49155;
            case "AL_STATIC":
              return 4136;
            case "AL_STOPPED":
              return 4116;
            case "AL_STREAMING":
              return 4137;
            case "AL_UNDETERMINED":
              return 4144;
            case "AL_UNUSED":
              return 8208;
            case "AL_VELOCITY":
              return 4102;
            case "AL_VENDOR":
              return 45057;
            case "AL_VERSION":
              return 45058;
            case "AL_AUTO_SOFT":
              return 2;
            case "AL_SOURCE_DISTANCE_MODEL":
              return 512;
            case "AL_SOURCE_SPATIALIZE_SOFT":
              return 4628;
            case "AL_LOOP_POINTS_SOFT":
              return 8213;
            case "AL_BYTE_LENGTH_SOFT":
              return 8201;
            case "AL_SAMPLE_LENGTH_SOFT":
              return 8202;
            case "AL_SEC_LENGTH_SOFT":
              return 8203;
            case "AL_FORMAT_MONO_FLOAT32":
              return 65552;
            case "AL_FORMAT_STEREO_FLOAT32":
              return 65553;
            default:
              AL.currentCtx.err = 40963;
              return 0;
          }
        };
        _alGetEnumValue.sig = "ip";
        var _alGetError = () => {
          if (!AL.currentCtx) {
            return 40964;
          }
          var e = AL.currentCtx.err;
          AL.currentCtx.err = 0;
          return e;
        };
        _alGetError.sig = "i";
        var _alGetFloat = e => {
          var r = AL.getGlobalParam("alGetFloat", e);
          if (r === null) {
            return 0;
          }
          switch (e) {
            case 49152:
            case 49155:
            case 53248:
              return r;
            default:
              return 0;
          }
        };
        _alGetFloat.sig = "fi";
        var _alGetFloatv = (e, r) => {
          var t = AL.getGlobalParam("alGetFloatv", e);
          if (t !== null && !!r) {
            switch (e) {
              case 49152:
              case 49155:
              case 53248:
                HEAPF32[r >> 2] = t;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetFloatv.sig = "vip";
        var _alGetInteger = e => {
          var r = AL.getGlobalParam("alGetInteger", e);
          if (r === null) {
            return 0;
          }
          switch (e) {
            case 49152:
            case 49155:
            case 53248:
              return r;
            default:
              AL.currentCtx.err = 40962;
              return 0;
          }
        };
        _alGetInteger.sig = "ii";
        var _alGetIntegerv = (e, r) => {
          var t = AL.getGlobalParam("alGetIntegerv", e);
          if (t !== null && !!r) {
            switch (e) {
              case 49152:
              case 49155:
              case 53248:
                HEAP32[r >> 2] = t;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetIntegerv.sig = "vip";
        var _alGetListener3f = (e, r, t, n) => {
          var a = AL.getListenerParam("alGetListener3f", e);
          if (a !== null) {
            if (!r || !t || !n) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                HEAPF32[r >> 2] = a[0];
                HEAPF32[t >> 2] = a[1];
                HEAPF32[n >> 2] = a[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetListener3f.sig = "vippp";
        var _alGetListener3i = (e, r, t, n) => {
          var a = AL.getListenerParam("alGetListener3i", e);
          if (a !== null) {
            if (!r || !t || !n) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                HEAP32[r >> 2] = a[0];
                HEAP32[t >> 2] = a[1];
                HEAP32[n >> 2] = a[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetListener3i.sig = "vippp";
        var _alGetListenerf = (e, r) => {
          var t = AL.getListenerParam("alGetListenerf", e);
          if (t !== null) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            if (e === 4106) {
              HEAPF32[r >> 2] = t;
            } else {
              AL.currentCtx.err = 40962;
              return;
            }
          }
        };
        _alGetListenerf.sig = "vip";
        var _alGetListenerfv = (e, r) => {
          var t = AL.getListenerParam("alGetListenerfv", e);
          if (t !== null) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                HEAPF32[r >> 2] = t[0];
                HEAPF32[r + 4 >> 2] = t[1];
                HEAPF32[r + 8 >> 2] = t[2];
                break;
              case 4111:
                HEAPF32[r >> 2] = t[0];
                HEAPF32[r + 4 >> 2] = t[1];
                HEAPF32[r + 8 >> 2] = t[2];
                HEAPF32[r + 12 >> 2] = t[3];
                HEAPF32[r + 16 >> 2] = t[4];
                HEAPF32[r + 20 >> 2] = t[5];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetListenerfv.sig = "vip";
        var _alGetListeneri = (e, r) => {
          var t = AL.getListenerParam("alGetListeneri", e);
          if (t !== null) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            AL.currentCtx.err = 40962;
          }
        };
        _alGetListeneri.sig = "vip";
        var _alGetListeneriv = (e, r) => {
          var t = AL.getListenerParam("alGetListeneriv", e);
          if (t !== null) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                HEAP32[r >> 2] = t[0];
                HEAP32[r + 4 >> 2] = t[1];
                HEAP32[r + 8 >> 2] = t[2];
                break;
              case 4111:
                HEAP32[r >> 2] = t[0];
                HEAP32[r + 4 >> 2] = t[1];
                HEAP32[r + 8 >> 2] = t[2];
                HEAP32[r + 12 >> 2] = t[3];
                HEAP32[r + 16 >> 2] = t[4];
                HEAP32[r + 20 >> 2] = t[5];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetListeneriv.sig = "vip";
        var _alGetSource3f = (e, r, t, n, a) => {
          var o = AL.getSourceParam("alGetSource3f", e, r);
          if (o !== null) {
            if (!t || !n || !a) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 4100:
              case 4101:
              case 4102:
                HEAPF32[t >> 2] = o[0];
                HEAPF32[n >> 2] = o[1];
                HEAPF32[a >> 2] = o[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSource3f.sig = "viippp";
        var _alGetSource3i = (e, r, t, n, a) => {
          var o = AL.getSourceParam("alGetSource3i", e, r);
          if (o !== null) {
            if (!t || !n || !a) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 4100:
              case 4101:
              case 4102:
                HEAP32[t >> 2] = o[0];
                HEAP32[n >> 2] = o[1];
                HEAP32[a >> 2] = o[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSource3i.sig = "viippp";
        var _alGetSourcef = (e, r, t) => {
          var n = AL.getSourceParam("alGetSourcef", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 4097:
              case 4098:
              case 4099:
              case 4106:
              case 4109:
              case 4110:
              case 4128:
              case 4129:
              case 4130:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 8203:
                HEAPF32[t >> 2] = n;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSourcef.sig = "viip";
        var _alGetSourcefv = (e, r, t) => {
          var n = AL.getSourceParam("alGetSourcefv", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 4097:
              case 4098:
              case 4099:
              case 4106:
              case 4109:
              case 4110:
              case 4128:
              case 4129:
              case 4130:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 8203:
                HEAPF32[t >> 2] = n[0];
                break;
              case 4100:
              case 4101:
              case 4102:
                HEAPF32[t >> 2] = n[0];
                HEAPF32[t + 4 >> 2] = n[1];
                HEAPF32[t + 8 >> 2] = n[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSourcefv.sig = "viip";
        var _alGetSourcei = (e, r, t) => {
          var n = AL.getSourceParam("alGetSourcei", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 514:
              case 4097:
              case 4098:
              case 4103:
              case 4105:
              case 4112:
              case 4117:
              case 4118:
              case 4128:
              case 4129:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 4135:
              case 4628:
              case 8201:
              case 8202:
              case 53248:
                HEAP32[t >> 2] = n;
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSourcei.sig = "viip";
        var _alGetSourceiv = (e, r, t) => {
          var n = AL.getSourceParam("alGetSourceiv", e, r);
          if (n !== null) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 514:
              case 4097:
              case 4098:
              case 4103:
              case 4105:
              case 4112:
              case 4117:
              case 4118:
              case 4128:
              case 4129:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 4135:
              case 4628:
              case 8201:
              case 8202:
              case 53248:
                HEAP32[t >> 2] = n;
                break;
              case 4100:
              case 4101:
              case 4102:
                HEAP32[t >> 2] = n[0];
                HEAP32[t + 4 >> 2] = n[1];
                HEAP32[t + 8 >> 2] = n[2];
                break;
              default:
                AL.currentCtx.err = 40962;
                return;
            }
          }
        };
        _alGetSourceiv.sig = "viip";
        var stringToNewUTF8 = e => {
          var r = lengthBytesUTF8(e) + 1;
          var t = _malloc(r);
          if (t) {
            stringToUTF8(e, t, r);
          }
          return t;
        };
        var _alGetString = e => {
          if (AL.stringCache[e]) {
            return AL.stringCache[e];
          }
          var r;
          switch (e) {
            case 0:
              r = "No Error";
              break;
            case 40961:
              r = "Invalid Name";
              break;
            case 40962:
              r = "Invalid Enum";
              break;
            case 40963:
              r = "Invalid Value";
              break;
            case 40964:
              r = "Invalid Operation";
              break;
            case 40965:
              r = "Out of Memory";
              break;
            case 45057:
              r = "Emscripten";
              break;
            case 45058:
              r = "1.1";
              break;
            case 45059:
              r = "WebAudio";
              break;
            case 45060:
              r = Object.keys(AL.AL_EXTENSIONS).join(" ");
              break;
            default:
              if (AL.currentCtx) {
                AL.currentCtx.err = 40962;
              }
              return 0;
          }
          r = stringToNewUTF8(r);
          AL.stringCache[e] = r;
          return r;
        };
        _alGetString.sig = "pi";
        var _alIsBuffer = e => !!AL.currentCtx && !(e > AL.buffers.length) && !!AL.buffers[e];
        _alIsBuffer.sig = "ii";
        var _alIsEnabled = e => AL.currentCtx ? e === 512 ? AL.currentCtx.sourceDistanceModel ? 0 : 1 : (AL.currentCtx.err = 40962, 0) : 0;
        _alIsEnabled.sig = "ii";
        var _alIsExtensionPresent = e => {
          var r = UTF8ToString(e);
          if (AL.AL_EXTENSIONS[r]) {
            return 1;
          } else {
            return 0;
          }
        };
        _alIsExtensionPresent.sig = "ip";
        var _alIsSource = e => !!AL.currentCtx && !!AL.currentCtx.sources[e];
        _alIsSource.sig = "ii";
        var _alListener3f = (e, r, t, n) => {
          switch (e) {
            case 4100:
            case 4102:
              AL.paramArray[0] = r;
              AL.paramArray[1] = t;
              AL.paramArray[2] = n;
              AL.setListenerParam("alListener3f", e, AL.paramArray);
              break;
            default:
              AL.setListenerParam("alListener3f", e, null);
              break;
          }
        };
        _alListener3f.sig = "vifff";
        var _alListener3i = (e, r, t, n) => {
          switch (e) {
            case 4100:
            case 4102:
              AL.paramArray[0] = r;
              AL.paramArray[1] = t;
              AL.paramArray[2] = n;
              AL.setListenerParam("alListener3i", e, AL.paramArray);
              break;
            default:
              AL.setListenerParam("alListener3i", e, null);
              break;
          }
        };
        _alListener3i.sig = "viiii";
        var _alListenerf = (e, r) => {
          if (e === 4106) {
            AL.setListenerParam("alListenerf", e, r);
          } else {
            AL.setListenerParam("alListenerf", e, null);
          }
        };
        _alListenerf.sig = "vif";
        var _alListenerfv = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                AL.paramArray[0] = HEAPF32[r >> 2];
                AL.paramArray[1] = HEAPF32[r + 4 >> 2];
                AL.paramArray[2] = HEAPF32[r + 8 >> 2];
                AL.setListenerParam("alListenerfv", e, AL.paramArray);
                break;
              case 4111:
                AL.paramArray[0] = HEAPF32[r >> 2];
                AL.paramArray[1] = HEAPF32[r + 4 >> 2];
                AL.paramArray[2] = HEAPF32[r + 8 >> 2];
                AL.paramArray[3] = HEAPF32[r + 12 >> 2];
                AL.paramArray[4] = HEAPF32[r + 16 >> 2];
                AL.paramArray[5] = HEAPF32[r + 20 >> 2];
                AL.setListenerParam("alListenerfv", e, AL.paramArray);
                break;
              default:
                AL.setListenerParam("alListenerfv", e, null);
                break;
            }
          }
        };
        _alListenerfv.sig = "vip";
        var _alListeneri = (e, r) => {
          AL.setListenerParam("alListeneri", e, null);
        };
        _alListeneri.sig = "vii";
        var _alListeneriv = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (e) {
              case 4100:
              case 4102:
                AL.paramArray[0] = HEAP32[r >> 2];
                AL.paramArray[1] = HEAP32[r + 4 >> 2];
                AL.paramArray[2] = HEAP32[r + 8 >> 2];
                AL.setListenerParam("alListeneriv", e, AL.paramArray);
                break;
              case 4111:
                AL.paramArray[0] = HEAP32[r >> 2];
                AL.paramArray[1] = HEAP32[r + 4 >> 2];
                AL.paramArray[2] = HEAP32[r + 8 >> 2];
                AL.paramArray[3] = HEAP32[r + 12 >> 2];
                AL.paramArray[4] = HEAP32[r + 16 >> 2];
                AL.paramArray[5] = HEAP32[r + 20 >> 2];
                AL.setListenerParam("alListeneriv", e, AL.paramArray);
                break;
              default:
                AL.setListenerParam("alListeneriv", e, null);
                break;
            }
          }
        };
        _alListeneriv.sig = "vip";
        var _alSource3f = (e, r, t, n, a) => {
          switch (r) {
            case 4100:
            case 4101:
            case 4102:
              AL.paramArray[0] = t;
              AL.paramArray[1] = n;
              AL.paramArray[2] = a;
              AL.setSourceParam("alSource3f", e, r, AL.paramArray);
              break;
            default:
              AL.setSourceParam("alSource3f", e, r, null);
              break;
          }
        };
        _alSource3f.sig = "viifff";
        var _alSource3i = (e, r, t, n, a) => {
          switch (r) {
            case 4100:
            case 4101:
            case 4102:
              AL.paramArray[0] = t;
              AL.paramArray[1] = n;
              AL.paramArray[2] = a;
              AL.setSourceParam("alSource3i", e, r, AL.paramArray);
              break;
            default:
              AL.setSourceParam("alSource3i", e, r, null);
              break;
          }
        };
        _alSource3i.sig = "viiiii";
        var _alSourcePause = e => {
          if (AL.currentCtx) {
            var r = AL.currentCtx.sources[e];
            if (!r) {
              AL.currentCtx.err = 40961;
              return;
            }
            AL.setSourceState(r, 4115);
          }
        };
        _alSourcePause.sig = "vi";
        var _alSourcePausev = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
            }
            for (var t = 0; t < e; ++t) {
              if (!AL.currentCtx.sources[HEAP32[r + t * 4 >> 2]]) {
                AL.currentCtx.err = 40961;
                return;
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              AL.setSourceState(AL.currentCtx.sources[n], 4115);
            }
          }
        };
        _alSourcePausev.sig = "vip";
        var _alSourcePlay = e => {
          if (AL.currentCtx) {
            var r = AL.currentCtx.sources[e];
            if (!r) {
              AL.currentCtx.err = 40961;
              return;
            }
            AL.setSourceState(r, 4114);
          }
        };
        _alSourcePlay.sig = "vi";
        var _alSourcePlayv = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
            }
            for (var t = 0; t < e; ++t) {
              if (!AL.currentCtx.sources[HEAP32[r + t * 4 >> 2]]) {
                AL.currentCtx.err = 40961;
                return;
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              AL.setSourceState(AL.currentCtx.sources[n], 4114);
            }
          }
        };
        _alSourcePlayv.sig = "vip";
        var _alSourceQueueBuffers = (e, r, t) => {
          if (AL.currentCtx) {
            var n = AL.currentCtx.sources[e];
            if (!n) {
              AL.currentCtx.err = 40961;
              return;
            }
            if (n.type === 4136) {
              AL.currentCtx.err = 40964;
              return;
            }
            if (r !== 0) {
              var a = AL.buffers[0];
              for (var o of n.bufQueue) {
                if (o.id !== 0) {
                  a = o;
                  break;
                }
              }
              for (var l = 0; l < r; ++l) {
                var c = HEAP32[t + l * 4 >> 2];
                var o = AL.buffers[c];
                if (!o) {
                  AL.currentCtx.err = 40961;
                  return;
                }
                if (a.id !== 0 && (o.frequency !== a.frequency || o.bytesPerSample !== a.bytesPerSample || o.channels !== a.channels)) {
                  AL.currentCtx.err = 40964;
                }
              }
              if (n.bufQueue.length === 1 && n.bufQueue[0].id === 0) {
                n.bufQueue.length = 0;
              }
              n.type = 4137;
              for (var l = 0; l < r; ++l) {
                var c = HEAP32[t + l * 4 >> 2];
                var o = AL.buffers[c];
                o.refCount++;
                n.bufQueue.push(o);
              }
              if (n.looping) {
                AL.cancelPendingSourceAudio(n);
              }
              AL.initSourcePanner(n);
              AL.scheduleSourceAudio(n);
            }
          }
        };
        _alSourceQueueBuffers.sig = "viip";
        var _alSourceRewind = e => {
          if (AL.currentCtx) {
            var r = AL.currentCtx.sources[e];
            if (!r) {
              AL.currentCtx.err = 40961;
              return;
            }
            AL.setSourceState(r, 4116);
            AL.setSourceState(r, 4113);
          }
        };
        _alSourceRewind.sig = "vi";
        var _alSourceRewindv = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
            }
            for (var t = 0; t < e; ++t) {
              if (!AL.currentCtx.sources[HEAP32[r + t * 4 >> 2]]) {
                AL.currentCtx.err = 40961;
                return;
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              AL.setSourceState(AL.currentCtx.sources[n], 4113);
            }
          }
        };
        _alSourceRewindv.sig = "vip";
        var _alSourceStop = e => {
          if (AL.currentCtx) {
            var r = AL.currentCtx.sources[e];
            if (!r) {
              AL.currentCtx.err = 40961;
              return;
            }
            AL.setSourceState(r, 4116);
          }
        };
        _alSourceStop.sig = "vi";
        var _alSourceStopv = (e, r) => {
          if (AL.currentCtx) {
            if (!r) {
              AL.currentCtx.err = 40963;
            }
            for (var t = 0; t < e; ++t) {
              if (!AL.currentCtx.sources[HEAP32[r + t * 4 >> 2]]) {
                AL.currentCtx.err = 40961;
                return;
              }
            }
            for (var t = 0; t < e; ++t) {
              var n = HEAP32[r + t * 4 >> 2];
              AL.setSourceState(AL.currentCtx.sources[n], 4116);
            }
          }
        };
        _alSourceStopv.sig = "vip";
        var _alSourceUnqueueBuffers = (e, r, t) => {
          if (AL.currentCtx) {
            var n = AL.currentCtx.sources[e];
            if (!n) {
              AL.currentCtx.err = 40961;
              return;
            }
            if (r > (n.bufQueue.length === 1 && n.bufQueue[0].id === 0 ? 0 : n.bufsProcessed)) {
              AL.currentCtx.err = 40963;
              return;
            }
            if (r !== 0) {
              for (var a = 0; a < r; a++) {
                var o = n.bufQueue.shift();
                o.refCount--;
                HEAP32[t + a * 4 >> 2] = o.id;
                n.bufsProcessed--;
              }
              if (n.bufQueue.length === 0) {
                n.bufQueue.push(AL.buffers[0]);
              }
              AL.initSourcePanner(n);
              AL.scheduleSourceAudio(n);
            }
          }
        };
        _alSourceUnqueueBuffers.sig = "viip";
        var _alSourcef = (e, r, t) => {
          switch (r) {
            case 4097:
            case 4098:
            case 4099:
            case 4106:
            case 4109:
            case 4110:
            case 4128:
            case 4129:
            case 4130:
            case 4131:
            case 4132:
            case 4133:
            case 4134:
            case 8203:
              AL.setSourceParam("alSourcef", e, r, t);
              break;
            default:
              AL.setSourceParam("alSourcef", e, r, null);
              break;
          }
        };
        _alSourcef.sig = "viif";
        var _alSourcefv = (e, r, t) => {
          if (AL.currentCtx) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 4097:
              case 4098:
              case 4099:
              case 4106:
              case 4109:
              case 4110:
              case 4128:
              case 4129:
              case 4130:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 8203:
                var n = HEAPF32[t >> 2];
                AL.setSourceParam("alSourcefv", e, r, n);
                break;
              case 4100:
              case 4101:
              case 4102:
                AL.paramArray[0] = HEAPF32[t >> 2];
                AL.paramArray[1] = HEAPF32[t + 4 >> 2];
                AL.paramArray[2] = HEAPF32[t + 8 >> 2];
                AL.setSourceParam("alSourcefv", e, r, AL.paramArray);
                break;
              default:
                AL.setSourceParam("alSourcefv", e, r, null);
                break;
            }
          }
        };
        _alSourcefv.sig = "viip";
        var _alSourceiv = (e, r, t) => {
          if (AL.currentCtx) {
            if (!t) {
              AL.currentCtx.err = 40963;
              return;
            }
            switch (r) {
              case 514:
              case 4097:
              case 4098:
              case 4103:
              case 4105:
              case 4128:
              case 4129:
              case 4131:
              case 4132:
              case 4133:
              case 4134:
              case 4628:
              case 8201:
              case 8202:
              case 53248:
                var n = HEAP32[t >> 2];
                AL.setSourceParam("alSourceiv", e, r, n);
                break;
              case 4100:
              case 4101:
              case 4102:
                AL.paramArray[0] = HEAP32[t >> 2];
                AL.paramArray[1] = HEAP32[t + 4 >> 2];
                AL.paramArray[2] = HEAP32[t + 8 >> 2];
                AL.setSourceParam("alSourceiv", e, r, AL.paramArray);
                break;
              default:
                AL.setSourceParam("alSourceiv", e, r, null);
                break;
            }
          }
        };
        _alSourceiv.sig = "viip";
        var _alSpeedOfSound = e => {
          AL.setGlobalParam("alSpeedOfSound", 49155, e);
        };
        _alSpeedOfSound.sig = "vf";
        var _alcCaptureCloseDevice = e => {
          var r = AL.requireValidCaptureDevice(e, "alcCaptureCloseDevice");
          if (r) {
            delete AL.captures[e];
            AL.freeIds.push(e);
            r.mediaStreamSourceNode?.disconnect();
            r.mergerNode?.disconnect();
            r.splitterNode?.disconnect();
            r.scriptProcessorNode?.disconnect();
            if (r.mediaStream) {
              r.mediaStream.getTracks().forEach(t => t.stop());
            }
            delete r.buffers;
            r.capturedFrameCount = 0;
            r.isCapturing = false;
            return true;
          } else {
            return false;
          }
        };
        _alcCaptureCloseDevice.sig = "ip";
        var autoResumeAudioContext = e => {
          for (var r of ["keydown", "mousedown", "touchstart"]) {
            for (var t of [document, document.getElementById("canvas")]) {
              t?.addEventListener(r, () => {
                if (e.state === "suspended") {
                  e.resume();
                }
              }, {
                once: true
              });
            }
          }
        };
        var _alcCaptureOpenDevice = (e, r, t, n) => {
          var a = AL.CAPTURE_DEVICE_NAME;
          if (e !== 0 && (a = UTF8ToString(e), a !== AL.CAPTURE_DEVICE_NAME)) {
            AL.alcErr = 40965;
            return 0;
          }
          if (n < 0) {
            AL.alcErr = 40964;
            return 0;
          }
          navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
          var o = navigator.getUserMedia || navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
          if (!o) {
            AL.alcErr = 40965;
            return 0;
          }
          var l = window.AudioContext || window.webkitAudioContext;
          if (!AL.sharedCaptureAudioCtx) {
            try {
              AL.sharedCaptureAudioCtx = new l();
            } catch {
              AL.alcErr = 40965;
              return 0;
            }
          }
          autoResumeAudioContext(AL.sharedCaptureAudioCtx);
          var c;
          switch (t) {
            case 65552:
            case 4353:
            case 4352:
              c = 1;
              break;
            case 65553:
            case 4355:
            case 4354:
              c = 2;
              break;
            default:
              AL.alcErr = 40964;
              return 0;
          }
          function _(A) {
            return new Float32Array(A);
          }
          function u(A) {
            return new Int16Array(A);
          }
          function m(A) {
            return new Uint8Array(A);
          }
          var f;
          var v;
          switch (t) {
            case 65552:
            case 65553:
              f = "f32";
              v = _;
              break;
            case 4353:
            case 4355:
              f = "i16";
              v = u;
              break;
            case 4352:
            case 4354:
              f = "u8";
              v = m;
              break;
          }
          var g = [];
          try {
            for (var h = 0; h < c; ++h) {
              g[h] = v(n);
            }
          } catch {
            AL.alcErr = 40965;
            return 0;
          }
          var p = {
            audioCtx: AL.sharedCaptureAudioCtx,
            deviceName: a,
            requestedSampleRate: r,
            requestedSampleType: f,
            outputChannelCount: c,
            inputChannelCount: null,
            mediaStreamError: null,
            mediaStreamSourceNode: null,
            mediaStream: null,
            mergerNode: null,
            splitterNode: null,
            scriptProcessorNode: null,
            isCapturing: false,
            buffers: g,
            get bufferFrameCapacity() {
              return g[0].length;
            },
            capturePlayhead: 0,
            captureReadhead: 0,
            capturedFrameCount: 0
          };
          var b = A => {
            p.mediaStreamError = A;
          };
          var S = A => {
            p.mediaStreamSourceNode = p.audioCtx.createMediaStreamSource(A);
            p.mediaStream = A;
            var k = 1;
            switch (p.mediaStreamSourceNode.channelCountMode) {
              case "max":
                k = c;
                break;
              case "clamped-max":
                k = Math.min(c, p.mediaStreamSourceNode.channelCount);
                break;
              case "explicit":
                k = p.mediaStreamSourceNode.channelCount;
                break;
            }
            p.inputChannelCount = k;
            var G = 512;
            p.scriptProcessorNode = p.audioCtx.createScriptProcessor(G, k, c);
            if (k > c) {
              p.mergerNode = p.audioCtx.createChannelMerger(k);
              p.mediaStreamSourceNode.connect(p.mergerNode);
              p.mergerNode.connect(p.scriptProcessorNode);
            } else if (k < c) {
              p.splitterNode = p.audioCtx.createChannelSplitter(c);
              p.mediaStreamSourceNode.connect(p.splitterNode);
              p.splitterNode.connect(p.scriptProcessorNode);
            } else {
              p.mediaStreamSourceNode.connect(p.scriptProcessorNode);
            }
            p.scriptProcessorNode.connect(p.audioCtx.destination);
            p.scriptProcessorNode.onaudioprocess = D => {
              if (p.isCapturing) {
                var F = p;
                var H = D.inputBuffer;
                switch (t) {
                  case 65552:
                    var I = H.getChannelData(0);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = I[z];
                    }
                    break;
                  case 65553:
                    var I = H.getChannelData(0);
                    var E = H.getChannelData(1);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = I[z];
                      F.buffers[1][x] = E[z];
                    }
                    break;
                  case 4353:
                    var I = H.getChannelData(0);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = I[z] * 32767;
                    }
                    break;
                  case 4355:
                    var I = H.getChannelData(0);
                    var E = H.getChannelData(1);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = I[z] * 32767;
                      F.buffers[1][x] = E[z] * 32767;
                    }
                    break;
                  case 4352:
                    var I = H.getChannelData(0);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = (I[z] + 1) * 127;
                    }
                    break;
                  case 4354:
                    var I = H.getChannelData(0);
                    var E = H.getChannelData(1);
                    for (var z = 0; z < H.length; ++z) {
                      var x = (F.capturePlayhead + z) % F.bufferFrameCapacity;
                      F.buffers[0][x] = (I[z] + 1) * 127;
                      F.buffers[1][x] = (E[z] + 1) * 127;
                    }
                    break;
                }
                F.capturePlayhead += H.length;
                F.capturePlayhead %= F.bufferFrameCapacity;
                F.capturedFrameCount += H.length;
                F.capturedFrameCount = Math.min(F.capturedFrameCount, F.bufferFrameCapacity);
              }
            };
          };
          if (navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
              audio: true
            }).then(S).catch(b);
          } else {
            navigator.getUserMedia({
              audio: true
            }, S, b);
          }
          var w = AL.newId();
          AL.captures[w] = p;
          return w;
        };
        _alcCaptureOpenDevice.sig = "ppiii";
        var _alcCaptureSamples = (e, r, t) => {
          var n = AL.requireValidCaptureDevice(e, "alcCaptureSamples");
          if (!n) {
            return;
          }
          var a = n.requestedSampleRate;
          var o = n.audioCtx.sampleRate;
          var l = o / a;
          if (t < 0 || t > n.capturedFrameCount / l) {
            AL.alcErr = 40964;
            return;
          }
          function c(A, k) {
            HEAPF32[r + A * 4 >> 2] = k;
          }
          function _(A, k) {
            HEAP16[r + A * 2 >> 1] = k;
          }
          function u(A, k) {
            HEAP8[r + A] = k;
          }
          var m;
          switch (n.requestedSampleType) {
            case "f32":
              m = c;
              break;
            case "i16":
              m = _;
              break;
            case "u8":
              m = u;
              break;
            default:
              return;
          }
          if (Math.floor(l) == l) {
            var f = 0;
            for (var v = 0; v < t; ++v) {
              for (var g = 0; g < n.buffers.length; ++g, ++f) {
                m(f, n.buffers[g][n.captureReadhead]);
              }
              n.captureReadhead = (l + n.captureReadhead) % n.bufferFrameCapacity;
            }
          } else {
            var f = 0;
            for (var v = 0; v < t; ++v) {
              var h = Math.floor(n.captureReadhead);
              var p = Math.ceil(n.captureReadhead);
              var b = n.captureReadhead - h;
              for (var g = 0; g < n.buffers.length; ++g, ++f) {
                var S = n.buffers[g][h];
                var w = n.buffers[g][p];
                m(f, (1 - b) * S + b * w);
              }
              n.captureReadhead = (n.captureReadhead + l) % n.bufferFrameCapacity;
            }
          }
          n.capturedFrameCount = 0;
        };
        _alcCaptureSamples.sig = "vppi";
        var _alcCaptureStart = e => {
          var r = AL.requireValidCaptureDevice(e, "alcCaptureStart");
          if (r) {
            if (!r.isCapturing) {
              r.isCapturing = true;
              r.capturedFrameCount = 0;
              r.capturePlayhead = 0;
            }
          }
        };
        _alcCaptureStart.sig = "vp";
        var _alcCaptureStop = e => {
          var r = AL.requireValidCaptureDevice(e, "alcCaptureStop");
          if (r) {
            r.isCapturing = false;
          }
        };
        _alcCaptureStop.sig = "vp";
        var _alcCloseDevice = e => !(e in AL.deviceRefCounts) || AL.deviceRefCounts[e] > 0 ? 0 : (delete AL.deviceRefCounts[e], AL.freeIds.push(e), 1);
        _alcCloseDevice.sig = "ip";
        var _alcCreateContext = (e, r) => {
          if (!(e in AL.deviceRefCounts)) {
            AL.alcErr = 40961;
            return 0;
          }
          var t = null;
          var n = [];
          var a = null;
          r >>= 2;
          if (r) {
            for (var o = 0, l = 0; o = HEAP32[r++], n.push(o), o !== 0;) {
              l = HEAP32[r++];
              n.push(l);
              switch (o) {
                case 4103:
                  t ||= {};
                  t.sampleRate = l;
                  break;
                case 4112:
                case 4113:
                  break;
                case 6546:
                  switch (l) {
                    case 0:
                      a = false;
                      break;
                    case 1:
                      a = true;
                      break;
                    case 2:
                      break;
                    default:
                      AL.alcErr = 40964;
                      return 0;
                  }
                  break;
                case 6550:
                  if (l !== 0) {
                    AL.alcErr = 40964;
                    return 0;
                  }
                  break;
                default:
                  AL.alcErr = 40964;
                  return 0;
              }
            }
          }
          var c = window.AudioContext || window.webkitAudioContext;
          var _ = null;
          try {
            if (t) {
              _ = new c(t);
            } else {
              _ = new c();
            }
          } catch (g) {
            if (g.name === "NotSupportedError") {
              AL.alcErr = 40964;
            } else {
              AL.alcErr = 40961;
            }
            return 0;
          }
          autoResumeAudioContext(_);
          if (typeof _.createGain === "undefined") {
            _.createGain = _.createGainNode;
          }
          var u = _.createGain();
          u.connect(_.destination);
          var m = {
            deviceId: e,
            id: AL.newId(),
            attrs: n,
            audioCtx: _,
            listener: {
              position: [0, 0, 0],
              velocity: [0, 0, 0],
              direction: [0, 0, 0],
              up: [0, 0, 0]
            },
            sources: [],
            interval: setInterval(() => AL.scheduleContextAudio(m), AL.QUEUE_INTERVAL),
            gain: u,
            distanceModel: 53250,
            speedOfSound: 343.3,
            dopplerFactor: 1,
            sourceDistanceModel: false,
            hrtf: a || false,
            _err: 0,
            get err() {
              return this._err;
            },
            set err(g) {
              if (this._err === 0 || g === 0) {
                this._err = g;
              }
            }
          };
          AL.deviceRefCounts[e]++;
          AL.contexts[m.id] = m;
          if (a !== null) {
            for (var f in AL.contexts) {
              var v = AL.contexts[f];
              if (v.deviceId === e) {
                v.hrtf = a;
                AL.updateContextGlobal(v);
              }
            }
          }
          return m.id;
        };
        _alcCreateContext.sig = "ppp";
        var _alcDestroyContext = e => {
          var r = AL.contexts[e];
          if (AL.currentCtx === r) {
            AL.alcErr = 40962;
            return;
          }
          if (AL.contexts[e].interval) {
            clearInterval(AL.contexts[e].interval);
          }
          AL.deviceRefCounts[r.deviceId]--;
          delete AL.contexts[e];
          AL.freeIds.push(e);
        };
        _alcDestroyContext.sig = "vp";
        var _alcGetContextsDevice = e => e in AL.contexts ? AL.contexts[e].deviceId : 0;
        _alcGetContextsDevice.sig = "pp";
        var _alcGetCurrentContext = () => AL.currentCtx !== null ? AL.currentCtx.id : 0;
        _alcGetCurrentContext.sig = "p";
        var _alcGetEnumValue = (e, r) => {
          if (e !== 0 && !(e in AL.deviceRefCounts)) {
            return 0;
          }
          if (!r) {
            AL.alcErr = 40964;
            return 0;
          }
          var t = UTF8ToString(r);
          switch (t) {
            case "ALC_NO_ERROR":
              return 0;
            case "ALC_INVALID_DEVICE":
              return 40961;
            case "ALC_INVALID_CONTEXT":
              return 40962;
            case "ALC_INVALID_ENUM":
              return 40963;
            case "ALC_INVALID_VALUE":
              return 40964;
            case "ALC_OUT_OF_MEMORY":
              return 40965;
            case "ALC_MAJOR_VERSION":
              return 4096;
            case "ALC_MINOR_VERSION":
              return 4097;
            case "ALC_ATTRIBUTES_SIZE":
              return 4098;
            case "ALC_ALL_ATTRIBUTES":
              return 4099;
            case "ALC_DEFAULT_DEVICE_SPECIFIER":
              return 4100;
            case "ALC_DEVICE_SPECIFIER":
              return 4101;
            case "ALC_EXTENSIONS":
              return 4102;
            case "ALC_FREQUENCY":
              return 4103;
            case "ALC_REFRESH":
              return 4104;
            case "ALC_SYNC":
              return 4105;
            case "ALC_MONO_SOURCES":
              return 4112;
            case "ALC_STEREO_SOURCES":
              return 4113;
            case "ALC_CAPTURE_DEVICE_SPECIFIER":
              return 784;
            case "ALC_CAPTURE_DEFAULT_DEVICE_SPECIFIER":
              return 785;
            case "ALC_CAPTURE_SAMPLES":
              return 786;
            case "ALC_HRTF_SOFT":
              return 6546;
            case "ALC_HRTF_ID_SOFT":
              return 6550;
            case "ALC_DONT_CARE_SOFT":
              return 2;
            case "ALC_HRTF_STATUS_SOFT":
              return 6547;
            case "ALC_NUM_HRTF_SPECIFIERS_SOFT":
              return 6548;
            case "ALC_HRTF_SPECIFIER_SOFT":
              return 6549;
            case "ALC_HRTF_DISABLED_SOFT":
              return 0;
            case "ALC_HRTF_ENABLED_SOFT":
              return 1;
            case "ALC_HRTF_DENIED_SOFT":
              return 2;
            case "ALC_HRTF_REQUIRED_SOFT":
              return 3;
            case "ALC_HRTF_HEADPHONES_DETECTED_SOFT":
              return 4;
            case "ALC_HRTF_UNSUPPORTED_FORMAT_SOFT":
              return 5;
            default:
              AL.alcErr = 40964;
              return 0;
          }
        };
        _alcGetEnumValue.sig = "ipp";
        var _alcGetError = e => {
          var r = AL.alcErr;
          AL.alcErr = 0;
          return r;
        };
        _alcGetError.sig = "ip";
        var _alcGetIntegerv = (e, r, t, n) => {
          if (t !== 0 && !!n) {
            switch (r) {
              case 4096:
                HEAP32[n >> 2] = 1;
                break;
              case 4097:
                HEAP32[n >> 2] = 1;
                break;
              case 4098:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                if (!AL.currentCtx) {
                  AL.alcErr = 40962;
                  return;
                }
                HEAP32[n >> 2] = AL.currentCtx.attrs.length;
                break;
              case 4099:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                if (!AL.currentCtx) {
                  AL.alcErr = 40962;
                  return;
                }
                for (var a = 0; a < AL.currentCtx.attrs.length; a++) {
                  HEAP32[n + a * 4 >> 2] = AL.currentCtx.attrs[a];
                }
                break;
              case 4103:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                if (!AL.currentCtx) {
                  AL.alcErr = 40962;
                  return;
                }
                HEAP32[n >> 2] = AL.currentCtx.audioCtx.sampleRate;
                break;
              case 4112:
              case 4113:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                if (!AL.currentCtx) {
                  AL.alcErr = 40962;
                  return;
                }
                HEAP32[n >> 2] = 2147483647;
                break;
              case 6546:
              case 6547:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                var o = 0;
                for (var l in AL.contexts) {
                  var c = AL.contexts[l];
                  if (c.deviceId === e) {
                    o = c.hrtf ? 1 : 0;
                  }
                }
                HEAP32[n >> 2] = o;
                break;
              case 6548:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                HEAP32[n >> 2] = 1;
                break;
              case 131075:
                if (!(e in AL.deviceRefCounts)) {
                  AL.alcErr = 40961;
                  return;
                }
                if (!AL.currentCtx) {
                  AL.alcErr = 40962;
                  return;
                }
                HEAP32[n >> 2] = 1;
              case 786:
                var _ = AL.requireValidCaptureDevice(e, "alcGetIntegerv");
                if (!_) {
                  return;
                }
                var u = _.capturedFrameCount;
                var m = _.requestedSampleRate;
                var f = _.audioCtx.sampleRate;
                var v = Math.floor(u * (m / f));
                HEAP32[n >> 2] = v;
                break;
              default:
                AL.alcErr = 40963;
                return;
            }
          }
        };
        _alcGetIntegerv.sig = "vpiip";
        var _alcGetString = (e, r) => {
          if (AL.alcStringCache[r]) {
            return AL.alcStringCache[r];
          }
          var t;
          switch (r) {
            case 0:
              t = "No Error";
              break;
            case 40961:
              t = "Invalid Device";
              break;
            case 40962:
              t = "Invalid Context";
              break;
            case 40963:
              t = "Invalid Enum";
              break;
            case 40964:
              t = "Invalid Value";
              break;
            case 40965:
              t = "Out of Memory";
              break;
            case 4100:
              if (globalThis.AudioContext || globalThis.webkitAudioContext) {
                t = AL.DEVICE_NAME;
              } else {
                return 0;
              }
              break;
            case 4101:
              if (globalThis.AudioContext || globalThis.webkitAudioContext) {
                t = AL.DEVICE_NAME + "\0";
              } else {
                t = "\0";
              }
              break;
            case 785:
              t = AL.CAPTURE_DEVICE_NAME;
              break;
            case 784:
              if (e === 0) {
                t = AL.CAPTURE_DEVICE_NAME + "\0";
              } else {
                var n = AL.requireValidCaptureDevice(e, "alcGetString");
                if (!n) {
                  return 0;
                }
                t = n.deviceName;
              }
              break;
            case 4102:
              if (!e) {
                AL.alcErr = 40961;
                return 0;
              }
              t = Object.keys(AL.ALC_EXTENSIONS).join(" ");
              break;
            default:
              AL.alcErr = 40963;
              return 0;
          }
          t = stringToNewUTF8(t);
          AL.alcStringCache[r] = t;
          return t;
        };
        _alcGetString.sig = "ppi";
        var _alcIsExtensionPresent = (e, r) => {
          var t = UTF8ToString(r);
          if (AL.ALC_EXTENSIONS[t]) {
            return 1;
          } else {
            return 0;
          }
        };
        _alcIsExtensionPresent.sig = "ipp";
        var _alcMakeContextCurrent = e => {
          if (e === 0) {
            AL.currentCtx = null;
          } else {
            AL.currentCtx = AL.contexts[e];
          }
          return 1;
        };
        _alcMakeContextCurrent.sig = "ip";
        var _alcOpenDevice = e => {
          if (e) {
            var r = UTF8ToString(e);
            if (r !== AL.DEVICE_NAME) {
              return 0;
            }
          }
          if (globalThis.AudioContext || globalThis.webkitAudioContext) {
            var t = AL.newId();
            AL.deviceRefCounts[t] = 0;
            return t;
          }
          return 0;
        };
        _alcOpenDevice.sig = "pp";
        var _alcProcessContext = e => {};
        _alcProcessContext.sig = "vp";
        var _alcSuspendContext = e => {};
        _alcSuspendContext.sig = "vp";
        var _emscripten_get_now_res = () => 1000;
        _emscripten_get_now_res.sig = "d";
        var nowIsMonotonic = 1;
        var checkWasiClock = e => e >= 0 && e <= 3;
        var _clock_res_get = (e, r) => {
          if (!checkWasiClock(e)) {
            return 28;
          }
          var t;
          if (e === 0) {
            t = 1000000;
          } else if (nowIsMonotonic) {
            t = _emscripten_get_now_res();
          } else {
            return 52;
          }
          HEAP64[r >> 3] = BigInt(t);
          return 0;
        };
        _clock_res_get.sig = "iip";
        var _emscripten_date_now = () => Date.now();
        _emscripten_date_now.sig = "d";
        function _clock_time_get(e, r, t) {
          r = bigintToI53Checked(r);
          if (!checkWasiClock(e)) {
            return 28;
          }
          var n;
          if (e === 0) {
            n = _emscripten_date_now();
          } else if (nowIsMonotonic) {
            n = _emscripten_get_now();
          } else {
            return 52;
          }
          var a = Math.round(n * 1000 * 1000);
          HEAP64[t >> 3] = BigInt(a);
          return 0;
        }
        _clock_time_get.sig = "iijp";
        function getFullscreenElement() {
          return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement;
        }
        var safeSetTimeout = (e, r) => setTimeout(() => {
          callUserCallback(e);
        }, r);
        var warnOnce = e => {
          warnOnce.shown ||= {};
          if (!warnOnce.shown[e]) {
            warnOnce.shown[e] = 1;
            err(e);
          }
        };
        var Browser = {
          useWebGL: false,
          isFullscreen: false,
          pointerLock: false,
          moduleContextCreatedCallbacks: [],
          workers: [],
          preloadedImages: {},
          preloadedAudios: {},
          getCanvas: () => Module.canvas,
          init() {
            if (Browser.initted) {
              return;
            }
            Browser.initted = true;
            var e = {};
            e.canHandle = function (o) {
              return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp|webp)$/i.test(o);
            };
            e.handle = async function (o, l) {
              var c = new Blob([o], {
                type: Browser.getMimetype(l)
              });
              if (c.size !== o.length) {
                c = new Blob([new Uint8Array(o).buffer], {
                  type: Browser.getMimetype(l)
                });
              }
              var _ = URL.createObjectURL(c);
              return new Promise((u, m) => {
                var f = new Image();
                f.onload = () => {
                  var v = document.createElement("canvas");
                  v.width = f.width;
                  v.height = f.height;
                  var g = v.getContext("2d");
                  g.drawImage(f, 0, 0);
                  Browser.preloadedImages[l] = v;
                  URL.revokeObjectURL(_);
                  u(o);
                };
                f.onerror = v => {
                  err(`Image ${_} could not be decoded`);
                  m();
                };
                f.src = _;
              });
            };
            preloadPlugins.push(e);
            var r = {};
            r.canHandle = function (o) {
              return !Module.noAudioDecoding && o.slice(-4) in {
                ".ogg": 1,
                ".wav": 1,
                ".mp3": 1
              };
            };
            r.handle = async function (o, l) {
              return new Promise((c, _) => {
                var u = false;
                function m(h) {
                  if (!u) {
                    u = true;
                    Browser.preloadedAudios[l] = h;
                    c(o);
                  }
                }
                var f = new Blob([o], {
                  type: Browser.getMimetype(l)
                });
                var v = URL.createObjectURL(f);
                var g = new Audio();
                g.addEventListener("canplaythrough", () => m(g), false);
                g.onerror = function (p) {
                  if (u) {
                    return;
                  }
                  err(`warning: browser could not fully decode audio ${l}, trying slower base64 approach`);
                  function b(S) {
                    var w = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                    var A = "=";
                    var k = "";
                    var G = 0;
                    var D = 0;
                    for (var F = 0; F < S.length; F++) {
                      G = G << 8 | S[F];
                      D += 8;
                      while (D >= 6) {
                        var H = G >> D - 6 & 63;
                        D -= 6;
                        k += w[H];
                      }
                    }
                    if (D == 2) {
                      k += w[(G & 3) << 4];
                      k += A + A;
                    } else if (D == 4) {
                      k += w[(G & 15) << 2];
                      k += A;
                    }
                    return k;
                  }
                  g.src = "data:audio/x-" + l.slice(-3) + ";base64," + b(o);
                  m(g);
                };
                g.src = v;
                safeSetTimeout(() => {
                  m(g);
                }, 10000);
              });
            };
            preloadPlugins.push(r);
            function t() {
              var a = Browser.getCanvas();
              Browser.pointerLock = document.pointerLockElement === a;
            }
            var n = Browser.getCanvas();
            if (n) {
              document.addEventListener("pointerlockchange", t, false);
              if (Module.elementPointerLock) {
                n.addEventListener("click", a => {
                  if (!Browser.pointerLock && Browser.getCanvas().requestPointerLock) {
                    Browser.getCanvas().requestPointerLock();
                    a.preventDefault();
                  }
                }, false);
              }
            }
          },
          createContext(e, r, t, n) {
            if (r && Module.ctx && e == Browser.getCanvas()) {
              return Module.ctx;
            }
            var a;
            var o;
            if (r) {
              var l = {
                antialias: false,
                alpha: false,
                majorVersion: 2
              };
              if (n) {
                for (var c in n) {
                  l[c] = n[c];
                }
              }
              if (typeof GL !== "undefined") {
                o = GL.createContext(e, l);
                if (o) {
                  a = GL.getContext(o).GLctx;
                }
              }
            } else {
              a = e.getContext("2d");
            }
            if (a) {
              if (t) {
                Module.ctx = a;
                if (r) {
                  GL.makeContextCurrent(o);
                }
                Browser.useWebGL = r;
                Browser.moduleContextCreatedCallbacks.forEach(_ => _());
                Browser.init();
              }
              return a;
            } else {
              return null;
            }
          },
          fullscreenHandlersInstalled: false,
          lockPointer: undefined,
          resizeCanvas: undefined,
          requestFullscreen(e, r) {
            Browser.lockPointer = e;
            Browser.resizeCanvas = r;
            if (typeof Browser.lockPointer === "undefined") {
              Browser.lockPointer = true;
            }
            if (typeof Browser.resizeCanvas === "undefined") {
              Browser.resizeCanvas = false;
            }
            var t = Browser.getCanvas();
            function n() {
              Browser.isFullscreen = false;
              var o = t.parentNode;
              if (getFullscreenElement() === o) {
                t.exitFullscreen = Browser.exitFullscreen;
                if (Browser.lockPointer) {
                  t.requestPointerLock();
                }
                Browser.isFullscreen = true;
                if (Browser.resizeCanvas) {
                  Browser.setFullscreenCanvasSize();
                } else {
                  Browser.updateCanvasDimensions(t);
                }
              } else {
                o.parentNode.insertBefore(t, o);
                o.parentNode.removeChild(o);
                if (Browser.resizeCanvas) {
                  Browser.setWindowedCanvasSize();
                } else {
                  Browser.updateCanvasDimensions(t);
                }
              }
              Module.onFullScreen?.(Browser.isFullscreen);
              Module.onFullscreen?.(Browser.isFullscreen);
            }
            if (!Browser.fullscreenHandlersInstalled) {
              Browser.fullscreenHandlersInstalled = true;
              document.addEventListener("fullscreenchange", n, false);
              document.addEventListener("mozfullscreenchange", n, false);
              document.addEventListener("webkitfullscreenchange", n, false);
              document.addEventListener("MSFullscreenChange", n, false);
            }
            var a = document.createElement("div");
            t.parentNode.insertBefore(a, t);
            a.appendChild(t);
            a.requestFullscreen = a.requestFullscreen || a.mozRequestFullScreen || a.msRequestFullscreen || (a.webkitRequestFullscreen ? () => a.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT) : null) || (a.webkitRequestFullScreen ? () => a.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT) : null);
            a.requestFullscreen();
          },
          exitFullscreen() {
            if (!Browser.isFullscreen) {
              return false;
            }
            var e = document.exitFullscreen || document.cancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen || document.webkitCancelFullScreen || (() => {});
            e.apply(document, []);
            return true;
          },
          safeSetTimeout(e, r) {
            return safeSetTimeout(e, r);
          },
          getMimetype(e) {
            return {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              bmp: "image/bmp",
              ogg: "audio/ogg",
              wav: "audio/wav",
              mp3: "audio/mpeg"
            }[e.slice(e.lastIndexOf(".") + 1)];
          },
          getUserMedia(e) {
            window.getUserMedia ||= navigator.getUserMedia || navigator.mozGetUserMedia;
            window.getUserMedia(e);
          },
          getMovementX(e) {
            return e.movementX || e.mozMovementX || e.webkitMovementX || 0;
          },
          getMovementY(e) {
            return e.movementY || e.mozMovementY || e.webkitMovementY || 0;
          },
          getMouseWheelDelta(e) {
            var r = 0;
            switch (e.type) {
              case "DOMMouseScroll":
                r = e.detail / 3;
                break;
              case "mousewheel":
                r = e.wheelDelta / 120;
                break;
              case "wheel":
                r = e.deltaY;
                switch (e.deltaMode) {
                  case 0:
                    r /= 100;
                    break;
                  case 1:
                    r /= 3;
                    break;
                  case 2:
                    r *= 80;
                    break;
                  default:
                    abort("unrecognized mouse wheel delta mode: " + e.deltaMode);
                }
                break;
              default:
                abort("unrecognized mouse wheel event: " + e.type);
            }
            return r;
          },
          mouseX: 0,
          mouseY: 0,
          mouseMovementX: 0,
          mouseMovementY: 0,
          touches: {},
          lastTouches: {},
          calculateMouseCoords(e, r) {
            var t = Browser.getCanvas();
            var n = t.getBoundingClientRect();
            var a = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
            var o = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
            var l = e - (a + n.left);
            var c = r - (o + n.top);
            l = l * (t.width / n.width);
            c = c * (t.height / n.height);
            return {
              x: l,
              y: c
            };
          },
          setMouseCoords(e, r) {
            let {
              x: t,
              y: n
            } = Browser.calculateMouseCoords(e, r);
            Browser.mouseMovementX = t - Browser.mouseX;
            Browser.mouseMovementY = n - Browser.mouseY;
            Browser.mouseX = t;
            Browser.mouseY = n;
          },
          calculateMouseEvent(e) {
            if (Browser.pointerLock) {
              if (e.type != "mousemove" && "mozMovementX" in e) {
                Browser.mouseMovementX = Browser.mouseMovementY = 0;
              } else {
                Browser.mouseMovementX = Browser.getMovementX(e);
                Browser.mouseMovementY = Browser.getMovementY(e);
              }
              Browser.mouseX += Browser.mouseMovementX;
              Browser.mouseY += Browser.mouseMovementY;
            } else {
              if (e.type === "touchstart" || e.type === "touchend" || e.type === "touchmove") {
                var r = e.touch;
                if (r === undefined) {
                  return;
                }
                var t = Browser.calculateMouseCoords(r.pageX, r.pageY);
                if (e.type === "touchstart") {
                  Browser.lastTouches[r.identifier] = t;
                  Browser.touches[r.identifier] = t;
                } else if (e.type === "touchend" || e.type === "touchmove") {
                  var n = Browser.touches[r.identifier];
                  n ||= t;
                  Browser.lastTouches[r.identifier] = n;
                  Browser.touches[r.identifier] = t;
                }
                return;
              }
              Browser.setMouseCoords(e.pageX, e.pageY);
            }
          },
          resizeListeners: [],
          updateResizeListeners() {
            var e = Browser.getCanvas();
            Browser.resizeListeners.forEach(r => r(e.width, e.height));
          },
          setCanvasSize(e, r, t) {
            var n = Browser.getCanvas();
            Browser.updateCanvasDimensions(n, e, r);
            if (!t) {
              Browser.updateResizeListeners();
            }
          },
          windowedWidth: 0,
          windowedHeight: 0,
          setFullscreenCanvasSize() {
            if (typeof SDL !== "undefined") {
              var e = HEAPU32[SDL.screen >> 2];
              e = e | 8388608;
              HEAP32[SDL.screen >> 2] = e;
            }
            Browser.updateCanvasDimensions(Browser.getCanvas());
            Browser.updateResizeListeners();
          },
          setWindowedCanvasSize() {
            if (typeof SDL !== "undefined") {
              var e = HEAPU32[SDL.screen >> 2];
              e = e & -8388609;
              HEAP32[SDL.screen >> 2] = e;
            }
            Browser.updateCanvasDimensions(Browser.getCanvas());
            Browser.updateResizeListeners();
          },
          updateCanvasDimensions(e, r, t) {
            if (r && t) {
              e.widthNative = r;
              e.heightNative = t;
            } else {
              r = e.widthNative;
              t = e.heightNative;
            }
            var n = r;
            var a = t;
            if (Module.forcedAspectRatio > 0) {
              if (n / a < Module.forcedAspectRatio) {
                n = Math.round(a * Module.forcedAspectRatio);
              } else {
                a = Math.round(n / Module.forcedAspectRatio);
              }
            }
            if (getFullscreenElement() === e.parentNode && typeof screen !== "undefined") {
              var o = Math.min(screen.width / n, screen.height / a);
              n = Math.round(n * o);
              a = Math.round(a * o);
            }
            if (Browser.resizeCanvas) {
              if (e.width != n) {
                e.width = n;
              }
              if (e.height != a) {
                e.height = a;
              }
              if (typeof e.style !== "undefined") {
                e.style.removeProperty("width");
                e.style.removeProperty("height");
              }
            } else {
              if (e.width != r) {
                e.width = r;
              }
              if (e.height != t) {
                e.height = t;
              }
              if (typeof e.style !== "undefined") {
                if (n != r || a != t) {
                  e.style.setProperty("width", n + "px", "important");
                  e.style.setProperty("height", a + "px", "important");
                } else {
                  e.style.removeProperty("width");
                  e.style.removeProperty("height");
                }
              }
            }
          }
        };
        var EGL = {
          errorCode: 12288,
          defaultDisplayInitialized: false,
          currentContext: 0,
          currentReadSurface: 0,
          currentDrawSurface: 0,
          contextAttributes: {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false
          },
          stringCache: {},
          setErrorCode(e) {
            EGL.errorCode = e;
          },
          chooseConfig(e, r, t, n, a) {
            if (e != 62000) {
              EGL.setErrorCode(12296);
              return 0;
            }
            if (r) {
              while (true) {
                var o = HEAP32[r >> 2];
                if (o == 12321) {
                  var l = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.alpha = l > 0;
                } else if (o == 12325) {
                  var c = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.depth = c > 0;
                } else if (o == 12326) {
                  var _ = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.stencil = _ > 0;
                } else if (o == 12337) {
                  var u = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.antialias = u > 0;
                } else if (o == 12338) {
                  var u = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.antialias = u == 1;
                } else if (o == 12544) {
                  var m = HEAP32[r + 4 >> 2];
                  EGL.contextAttributes.lowLatency = m != 12547;
                } else if (o == 12344) {
                  break;
                }
                r += 8;
              }
            }
            if ((!t || !n) && !a) {
              EGL.setErrorCode(12300);
              return 0;
            } else {
              if (a) {
                HEAP32[a >> 2] = 1;
              }
              if (t && n > 0) {
                HEAPU32[t >> 2] = 62002;
              }
              EGL.setErrorCode(12288);
              return 1;
            }
          }
        };
        var _eglBindAPI = e => e == 12448 ? (EGL.setErrorCode(12288), 1) : (EGL.setErrorCode(12300), 0);
        _eglBindAPI.sig = "ii";
        var _eglChooseConfig = (e, r, t, n, a) => EGL.chooseConfig(e, r, t, n, a);
        _eglChooseConfig.sig = "ipppip";
        var GLctx;
        var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = e => !!(e.dibvbi = e.getExtension("WEBGL_draw_instanced_base_vertex_base_instance"));
        var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = e => !!(e.mdibvbi = e.getExtension("WEBGL_multi_draw_instanced_base_vertex_base_instance"));
        var webgl_enable_EXT_polygon_offset_clamp = e => !!(e.extPolygonOffsetClamp = e.getExtension("EXT_polygon_offset_clamp"));
        var webgl_enable_EXT_clip_control = e => !!(e.extClipControl = e.getExtension("EXT_clip_control"));
        var webgl_enable_WEBGL_polygon_mode = e => !!(e.webglPolygonMode = e.getExtension("WEBGL_polygon_mode"));
        var webgl_enable_WEBGL_multi_draw = e => !!(e.multiDrawWebgl = e.getExtension("WEBGL_multi_draw"));
        var getEmscriptenSupportedExtensions = e => {
          var r = ["EXT_color_buffer_float", "EXT_conservative_depth", "EXT_disjoint_timer_query_webgl2", "EXT_texture_norm16", "NV_shader_noperspective_interpolation", "WEBGL_clip_cull_distance", "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode"];
          return (e.getSupportedExtensions() || []).filter(t => r.includes(t));
        };
        var registerPreMainLoop = e => {
          if (typeof MainLoop !== "undefined") {
            MainLoop.preMainLoop.push(e);
          }
        };
        var GL = {
          counter: 1,
          buffers: [],
          programs: [],
          framebuffers: [],
          renderbuffers: [],
          textures: [],
          shaders: [],
          vaos: [],
          contexts: [],
          offscreenCanvases: {},
          queries: [],
          samplers: [],
          transformFeedbacks: [],
          syncs: [],
          byteSizeByTypeRoot: 5120,
          byteSizeByType: [1, 1, 2, 2, 4, 4, 4, 2, 3, 4, 8],
          stringCache: {},
          stringiCache: {},
          unpackAlignment: 4,
          unpackRowLength: 0,
          recordError: e => {
            GL.lastError ||= e;
          },
          getNewId: e => {
            for (var r = GL.counter++, t = e.length; t < r; t++) {
              e[t] = null;
            }
            while (e[r]) {
              r = GL.counter++;
            }
            return r;
          },
          genObject: (e, r, t, n) => {
            for (var a = 0; a < e; a++) {
              var o = GLctx[t]();
              var l = o && GL.getNewId(n);
              if (o) {
                o.name = l;
                n[l] = o;
              } else {
                GL.recordError(1282);
              }
              HEAP32[r + a * 4 >> 2] = l;
            }
          },
          MAX_TEMP_BUFFER_SIZE: 2097152,
          numTempVertexBuffersPerSize: 64,
          log2ceilLookup: e => 32 - Math.clz32(e === 0 ? 0 : e - 1),
          generateTempBuffers: (e, r) => {
            var t = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE);
            r.tempVertexBufferCounters1 = [];
            r.tempVertexBufferCounters2 = [];
            r.tempVertexBufferCounters1.length = r.tempVertexBufferCounters2.length = t + 1;
            r.tempVertexBuffers1 = [];
            r.tempVertexBuffers2 = [];
            r.tempVertexBuffers1.length = r.tempVertexBuffers2.length = t + 1;
            r.tempIndexBuffers = [];
            r.tempIndexBuffers.length = t + 1;
            for (var n = 0; n <= t; ++n) {
              r.tempIndexBuffers[n] = null;
              r.tempVertexBufferCounters1[n] = r.tempVertexBufferCounters2[n] = 0;
              var a = GL.numTempVertexBuffersPerSize;
              r.tempVertexBuffers1[n] = [];
              r.tempVertexBuffers2[n] = [];
              var o = r.tempVertexBuffers1[n];
              var l = r.tempVertexBuffers2[n];
              o.length = l.length = a;
              for (var c = 0; c < a; ++c) {
                o[c] = l[c] = null;
              }
            }
            if (e) {
              r.tempQuadIndexBuffer = GLctx.createBuffer();
              r.GLctx.bindBuffer(34963, r.tempQuadIndexBuffer);
              for (var _ = GL.MAX_TEMP_BUFFER_SIZE >> 1, u = new Uint16Array(_), n = 0, m = 0; u[n++] = m, !(n >= _) && !(u[n++] = m + 1, n >= _) && !(u[n++] = m + 2, n >= _) && !(u[n++] = m, n >= _) && !(u[n++] = m + 2, n >= _) && !(u[n++] = m + 3, n >= _);) {
                m += 4;
              }
              r.GLctx.bufferData(34963, u, 35044);
              r.GLctx.bindBuffer(34963, null);
            }
          },
          getTempVertexBuffer: e => {
            var r = GL.log2ceilLookup(e);
            var t = GL.currentContext.tempVertexBuffers1[r];
            var n = GL.currentContext.tempVertexBufferCounters1[r];
            GL.currentContext.tempVertexBufferCounters1[r] = GL.currentContext.tempVertexBufferCounters1[r] + 1 & GL.numTempVertexBuffersPerSize - 1;
            var a = t[n];
            if (a) {
              return a;
            }
            var o = GLctx.getParameter(34964);
            t[n] = GLctx.createBuffer();
            GLctx.bindBuffer(34962, t[n]);
            GLctx.bufferData(34962, 1 << r, 35048);
            GLctx.bindBuffer(34962, o);
            return t[n];
          },
          getTempIndexBuffer: e => {
            var r = GL.log2ceilLookup(e);
            var t = GL.currentContext.tempIndexBuffers[r];
            if (t) {
              return t;
            }
            var n = GLctx.getParameter(34965);
            GL.currentContext.tempIndexBuffers[r] = GLctx.createBuffer();
            GLctx.bindBuffer(34963, GL.currentContext.tempIndexBuffers[r]);
            GLctx.bufferData(34963, 1 << r, 35048);
            GLctx.bindBuffer(34963, n);
            return GL.currentContext.tempIndexBuffers[r];
          },
          newRenderingFrameStarted: () => {
            if (GL.currentContext) {
              var e = GL.currentContext.tempVertexBuffers1;
              GL.currentContext.tempVertexBuffers1 = GL.currentContext.tempVertexBuffers2;
              GL.currentContext.tempVertexBuffers2 = e;
              e = GL.currentContext.tempVertexBufferCounters1;
              GL.currentContext.tempVertexBufferCounters1 = GL.currentContext.tempVertexBufferCounters2;
              GL.currentContext.tempVertexBufferCounters2 = e;
              for (var r = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE), t = 0; t <= r; ++t) {
                GL.currentContext.tempVertexBufferCounters1[t] = 0;
              }
            }
          },
          getSource: (e, r, t, n) => {
            var a = "";
            for (var o = 0; o < r; ++o) {
              var l = n ? HEAPU32[n + o * 4 >> 2] : undefined;
              a += UTF8ToString(HEAPU32[t + o * 4 >> 2], l);
            }
            return a;
          },
          calcBufLength: (e, r, t, n) => {
            if (t > 0) {
              return n * t;
            }
            var a = GL.byteSizeByType[r - GL.byteSizeByTypeRoot];
            return e * a * n;
          },
          usedTempBuffers: [],
          preDrawHandleClientVertexAttribBindings: e => {
            GL.resetBufferBinding = false;
            for (var r = 0; r < GL.currentContext.maxVertexAttribs; ++r) {
              var t = GL.currentContext.clientBuffers[r];
              if (!!t.clientside && !!t.enabled) {
                GL.resetBufferBinding = true;
                var n = GL.calcBufLength(t.size, t.type, t.stride, e);
                var a = GL.getTempVertexBuffer(n);
                GLctx.bindBuffer(34962, a);
                GLctx.bufferSubData(34962, 0, HEAPU8.subarray(t.ptr, t.ptr + n));
                t.vertexAttribPointerAdaptor.call(GLctx, r, t.size, t.type, t.normalized, t.stride, 0);
              }
            }
          },
          postDrawHandleClientVertexAttribBindings: () => {
            if (GL.resetBufferBinding) {
              GLctx.bindBuffer(34962, GL.buffers[GLctx.currentArrayBufferBinding]);
            }
          },
          createContext: (e, r) => {
            if (!e.getContextSafariWebGL2Fixed) {
              let a = function (o, l) {
                var c = e.getContextSafariWebGL2Fixed(o, l);
                if (o == "webgl" == c instanceof WebGLRenderingContext) {
                  return c;
                } else {
                  return null;
                }
              };
              e.getContextSafariWebGL2Fixed = e.getContext;
              e.getContext = a;
            }
            var t = e.getContext("webgl2", r);
            if (!t) {
              return 0;
            }
            var n = GL.registerContext(t, r);
            return n;
          },
          registerContext: (e, r) => {
            var t = GL.getNewId(GL.contexts);
            var n = {
              handle: t,
              attributes: r,
              version: r.majorVersion,
              GLctx: e
            };
            if (e.canvas) {
              e.canvas.GLctxObject = n;
            }
            GL.contexts[t] = n;
            if (typeof r.enableExtensionsByDefault === "undefined" || r.enableExtensionsByDefault) {
              GL.initExtensions(n);
            }
            n.maxVertexAttribs = n.GLctx.getParameter(34921);
            n.clientBuffers = [];
            for (var a = 0; a < n.maxVertexAttribs; a++) {
              n.clientBuffers[a] = {
                enabled: false,
                clientside: false,
                size: 0,
                type: 0,
                normalized: 0,
                stride: 0,
                ptr: 0,
                vertexAttribPointerAdaptor: null
              };
            }
            GL.generateTempBuffers(false, n);
            return t;
          },
          makeContextCurrent: e => {
            GL.currentContext = GL.contexts[e];
            Module.ctx = GLctx = GL.currentContext?.GLctx;
            return !e || !!GLctx;
          },
          getContext: e => GL.contexts[e],
          deleteContext: e => {
            if (GL.currentContext === GL.contexts[e]) {
              GL.currentContext = null;
            }
            if (typeof JSEvents == "object") {
              JSEvents.removeAllHandlersOnTarget(GL.contexts[e].GLctx.canvas);
            }
            if (GL.contexts[e]?.GLctx.canvas) {
              GL.contexts[e].GLctx.canvas.GLctxObject = undefined;
            }
            GL.contexts[e] = null;
          },
          initExtensions: e => {
            e ||= GL.currentContext;
            if (!e.initExtensionsDone) {
              e.initExtensionsDone = true;
              var r = e.GLctx;
              webgl_enable_WEBGL_multi_draw(r);
              webgl_enable_EXT_polygon_offset_clamp(r);
              webgl_enable_EXT_clip_control(r);
              webgl_enable_WEBGL_polygon_mode(r);
              webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(r);
              webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(r);
              if (e.version >= 2) {
                r.disjointTimerQueryExt = r.getExtension("EXT_disjoint_timer_query_webgl2");
              }
              if (e.version < 2 || !r.disjointTimerQueryExt) {
                r.disjointTimerQueryExt = r.getExtension("EXT_disjoint_timer_query");
              }
              for (var t of getEmscriptenSupportedExtensions(r)) {
                if (!t.includes("lose_context") && !t.includes("debug")) {
                  r.getExtension(t);
                }
              }
            }
          }
        };
        var _eglCreateContext = (e, r, t, n) => {
          if (e != 62000) {
            EGL.setErrorCode(12296);
            return 0;
          }
          var a = 1;
          for (;;) {
            var o = HEAP32[n >> 2];
            if (o == 12440) {
              a = HEAP32[n + 4 >> 2];
            } else {
              if (o == 12344) {
                break;
              }
              EGL.setErrorCode(12292);
              return 0;
            }
            n += 8;
          }
          if (a < 2 || a > 3) {
            EGL.setErrorCode(12293);
            return 0;
          } else {
            EGL.contextAttributes.majorVersion = a - 1;
            EGL.contextAttributes.minorVersion = 0;
            EGL.context = GL.createContext(Browser.getCanvas(), EGL.contextAttributes);
            if (EGL.context != 0) {
              EGL.setErrorCode(12288);
              GL.makeContextCurrent(EGL.context);
              Browser.useWebGL = true;
              Browser.moduleContextCreatedCallbacks.forEach(l => l());
              GL.makeContextCurrent(null);
              return 62004;
            } else {
              EGL.setErrorCode(12297);
              return 0;
            }
          }
        };
        _eglCreateContext.sig = "ppppp";
        var _eglCreateWindowSurface = (e, r, t, n) => e != 62000 ? (EGL.setErrorCode(12296), 0) : r != 62002 ? (EGL.setErrorCode(12293), 0) : (EGL.setErrorCode(12288), 62006);
        _eglCreateWindowSurface.sig = "pppip";
        var _eglDestroyContext = (e, r) => e != 62000 ? (EGL.setErrorCode(12296), 0) : r != 62004 ? (EGL.setErrorCode(12294), 0) : (GL.deleteContext(EGL.context), EGL.setErrorCode(12288), EGL.currentContext == r && (EGL.currentContext = 0), 1);
        _eglDestroyContext.sig = "ipp";
        var _eglDestroySurface = (e, r) => e != 62000 ? (EGL.setErrorCode(12296), 0) : r != 62006 ? (EGL.setErrorCode(12301), 1) : (EGL.currentReadSurface == r && (EGL.currentReadSurface = 0), EGL.currentDrawSurface == r && (EGL.currentDrawSurface = 0), EGL.setErrorCode(12288), 1);
        _eglDestroySurface.sig = "ipp";
        var _eglGetConfigAttrib = (e, r, t, n) => {
          if (e != 62000) {
            EGL.setErrorCode(12296);
            return 0;
          }
          if (r != 62002) {
            EGL.setErrorCode(12293);
            return 0;
          }
          if (!n) {
            EGL.setErrorCode(12300);
            return 0;
          }
          EGL.setErrorCode(12288);
          switch (t) {
            case 12320:
              HEAP32[n >> 2] = EGL.contextAttributes.alpha ? 32 : 24;
              return 1;
            case 12321:
              HEAP32[n >> 2] = EGL.contextAttributes.alpha ? 8 : 0;
              return 1;
            case 12322:
              HEAP32[n >> 2] = 8;
              return 1;
            case 12323:
              HEAP32[n >> 2] = 8;
              return 1;
            case 12324:
              HEAP32[n >> 2] = 8;
              return 1;
            case 12325:
              HEAP32[n >> 2] = EGL.contextAttributes.depth ? 24 : 0;
              return 1;
            case 12326:
              HEAP32[n >> 2] = EGL.contextAttributes.stencil ? 8 : 0;
              return 1;
            case 12327:
              HEAP32[n >> 2] = 12344;
              return 1;
            case 12328:
              HEAP32[n >> 2] = 62002;
              return 1;
            case 12329:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12330:
              HEAP32[n >> 2] = 4096;
              return 1;
            case 12331:
              HEAP32[n >> 2] = 16777216;
              return 1;
            case 12332:
              HEAP32[n >> 2] = 4096;
              return 1;
            case 12333:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12334:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12335:
              HEAP32[n >> 2] = 12344;
              return 1;
            case 12337:
              HEAP32[n >> 2] = EGL.contextAttributes.antialias ? 4 : 0;
              return 1;
            case 12338:
              HEAP32[n >> 2] = EGL.contextAttributes.antialias ? 1 : 0;
              return 1;
            case 12339:
              HEAP32[n >> 2] = 4;
              return 1;
            case 12340:
              HEAP32[n >> 2] = 12344;
              return 1;
            case 12341:
            case 12342:
            case 12343:
              HEAP32[n >> 2] = -1;
              return 1;
            case 12345:
            case 12346:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12347:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12348:
              HEAP32[n >> 2] = 1;
              return 1;
            case 12349:
            case 12350:
              HEAP32[n >> 2] = 0;
              return 1;
            case 12351:
              HEAP32[n >> 2] = 12430;
              return 1;
            case 12352:
              HEAP32[n >> 2] = 4;
              return 1;
            case 12354:
              HEAP32[n >> 2] = 0;
              return 1;
            default:
              EGL.setErrorCode(12292);
              return 0;
          }
        };
        _eglGetConfigAttrib.sig = "ippip";
        var _eglGetDisplay = e => {
          EGL.setErrorCode(12288);
          if (e != 0 && e != 1) {
            return 0;
          } else {
            return 62000;
          }
        };
        _eglGetDisplay.sig = "pp";
        var _eglGetError = () => EGL.errorCode;
        _eglGetError.sig = "i";
        var _eglInitialize = (e, r, t) => e != 62000 ? (EGL.setErrorCode(12296), 0) : (r && (HEAP32[r >> 2] = 1), t && (HEAP32[t >> 2] = 4), EGL.defaultDisplayInitialized = true, EGL.setErrorCode(12288), 1);
        _eglInitialize.sig = "ippp";
        var _eglMakeCurrent = (e, r, t, n) => e != 62000 ? (EGL.setErrorCode(12296), 0) : n != 0 && n != 62004 ? (EGL.setErrorCode(12294), 0) : t != 0 && t != 62006 || r != 0 && r != 62006 ? (EGL.setErrorCode(12301), 0) : (GL.makeContextCurrent(n ? EGL.context : null), EGL.currentContext = n, EGL.currentDrawSurface = r, EGL.currentReadSurface = t, EGL.setErrorCode(12288), 1);
        _eglMakeCurrent.sig = "ipppp";
        var _eglQueryString = (e, r) => {
          if (e != 62000) {
            EGL.setErrorCode(12296);
            return 0;
          }
          EGL.setErrorCode(12288);
          if (EGL.stringCache[r]) {
            return EGL.stringCache[r];
          }
          var t;
          switch (r) {
            case 12371:
              t = stringToNewUTF8("Emscripten");
              break;
            case 12372:
              t = stringToNewUTF8("1.4 Emscripten EGL");
              break;
            case 12373:
              t = stringToNewUTF8("");
              break;
            case 12429:
              t = stringToNewUTF8("OpenGL_ES");
              break;
            default:
              EGL.setErrorCode(12300);
              return 0;
          }
          EGL.stringCache[r] = t;
          return t;
        };
        _eglQueryString.sig = "ppi";
        var _eglSwapBuffers = (e, r) => {
          if (!EGL.defaultDisplayInitialized) {
            EGL.setErrorCode(12289);
          } else if (!GLctx) {
            EGL.setErrorCode(12290);
          } else if (GLctx.isContextLost()) {
            EGL.setErrorCode(12302);
          } else {
            EGL.setErrorCode(12288);
            return 1;
          }
          return 0;
        };
        _eglSwapBuffers.sig = "ipp";
        var _eglSwapInterval = (e, r) => e != 62000 ? (EGL.setErrorCode(12296), 0) : (r == 0 ? _emscripten_set_main_loop_timing(0, 0) : _emscripten_set_main_loop_timing(1, r), EGL.setErrorCode(12288), 1);
        _eglSwapInterval.sig = "ipi";
        var _eglTerminate = e => e != 62000 ? (EGL.setErrorCode(12296), 0) : (EGL.currentContext = 0, EGL.currentReadSurface = 0, EGL.currentDrawSurface = 0, EGL.defaultDisplayInitialized = false, EGL.setErrorCode(12288), 1);
        _eglTerminate.sig = "ip";
        var _eglWaitClient = () => {
          EGL.setErrorCode(12288);
          return 1;
        };
        _eglWaitClient.sig = "i";
        var _eglWaitGL = _eglWaitClient;
        _eglWaitGL.sig = "i";
        var _eglWaitNative = e => {
          EGL.setErrorCode(12288);
          return 1;
        };
        _eglWaitNative.sig = "ii";
        var _emscripten_alcDevicePauseSOFT = e => {
          if (!(e in AL.deviceRefCounts)) {
            AL.alcErr = 40961;
            return;
          }
          if (!AL.paused) {
            AL.paused = true;
            for (var r in AL.contexts) {
              var t = AL.contexts[r];
              if (t.deviceId === e) {
                t.audioCtx.suspend();
                clearInterval(t.interval);
                t.interval = null;
              }
            }
          }
        };
        _emscripten_alcDevicePauseSOFT.sig = "vi";
        var _emscripten_alcDeviceResumeSOFT = e => {
          if (!(e in AL.deviceRefCounts)) {
            AL.alcErr = 40961;
            return;
          }
          if (AL.paused) {
            AL.paused = false;
            for (var r in AL.contexts) {
              var t = AL.contexts[r];
              if (t.deviceId === e) {
                t.interval = setInterval(() => AL.scheduleContextAudio(t), AL.QUEUE_INTERVAL);
                t.audioCtx.resume();
              }
            }
          }
        };
        _emscripten_alcDeviceResumeSOFT.sig = "vi";
        var _emscripten_alcGetStringiSOFT = (e, r, t) => {
          if (!(e in AL.deviceRefCounts)) {
            AL.alcErr = 40961;
            return 0;
          }
          if (AL.alcStringCache[r]) {
            return AL.alcStringCache[r];
          }
          var n;
          switch (r) {
            case 6549:
              if (t === 0) {
                n = "Web Audio HRTF";
              } else {
                AL.alcErr = 40964;
                return 0;
              }
              break;
            default:
              if (t !== 0) {
                AL.alcErr = 40963;
                return 0;
              } else {
                return _alcGetString(e, r);
              }
          }
          n = stringToNewUTF8(n);
          AL.alcStringCache[r] = n;
          return n;
        };
        _emscripten_alcGetStringiSOFT.sig = "iiii";
        var _emscripten_alcResetDeviceSOFT = (e, r) => {
          if (!(e in AL.deviceRefCounts)) {
            AL.alcErr = 40961;
            return 0;
          }
          var t = null;
          r >>= 2;
          if (r) {
            for (var n = 0, a = 0; n = HEAP32[r++], n !== 0;) {
              a = HEAP32[r++];
              if (n === 6546) {
                if (a === 1) {
                  t = true;
                } else if (a === 0) {
                  t = false;
                }
              }
            }
          }
          if (t !== null) {
            for (var o in AL.contexts) {
              var l = AL.contexts[o];
              if (l.deviceId === e) {
                l.hrtf = t;
                AL.updateContextGlobal(l);
              }
            }
          }
          return 1;
        };
        _emscripten_alcResetDeviceSOFT.sig = "iii";
        var readEmAsmArgsArray = [];
        var readEmAsmArgs = (e, r) => {
          readEmAsmArgsArray.length = 0;
          for (var t; t = HEAPU8[e++];) {
            var n = t != 105;
            n &= t != 112;
            r += n && r % 8 ? 4 : 0;
            readEmAsmArgsArray.push(t == 112 ? HEAPU32[r >> 2] : t == 106 ? HEAP64[r >> 3] : t == 105 ? HEAP32[r >> 2] : HEAPF64[r >> 3]);
            r += n ? 8 : 4;
          }
          return readEmAsmArgsArray;
        };
        var runEmAsmFunction = (e, r, t) => {
          var n = readEmAsmArgs(r, t);
          return ASM_CONSTS[e](...n);
        };
        var _emscripten_asm_const_int = (e, r, t) => runEmAsmFunction(e, r, t);
        _emscripten_asm_const_int.sig = "ippp";
        var runMainThreadEmAsm = (e, r, t, n) => {
          var a = readEmAsmArgs(r, t);
          return ASM_CONSTS[e](...a);
        };
        var _emscripten_asm_const_int_sync_on_main_thread = (e, r, t) => runMainThreadEmAsm(e, r, t, 1);
        _emscripten_asm_const_int_sync_on_main_thread.sig = "ippp";
        var _emscripten_asm_const_ptr = (e, r, t) => runEmAsmFunction(e, r, t);
        _emscripten_asm_const_ptr.sig = "pppp";
        var _emscripten_asm_const_ptr_sync_on_main_thread = (e, r, t) => runMainThreadEmAsm(e, r, t, 1);
        _emscripten_asm_const_ptr_sync_on_main_thread.sig = "pppp";
        var _emscripten_cancel_main_loop = () => {
          MainLoop.pause();
          MainLoop.func = null;
        };
        _emscripten_cancel_main_loop.sig = "v";
        var _emscripten_clear_timeout = clearTimeout;
        _emscripten_clear_timeout.sig = "vi";
        var _emscripten_console_error = e => {
          console.error(UTF8ToString(e));
        };
        _emscripten_console_error.sig = "vp";
        var _emscripten_console_log = e => {
          console.log(UTF8ToString(e));
        };
        _emscripten_console_log.sig = "vp";
        var _emscripten_console_trace = e => {
          console.trace(UTF8ToString(e));
        };
        _emscripten_console_trace.sig = "vp";
        var _emscripten_console_warn = e => {
          console.warn(UTF8ToString(e));
        };
        _emscripten_console_warn.sig = "vp";
        var _emscripten_err = e => err(UTF8ToString(e));
        _emscripten_err.sig = "vp";
        var specialHTMLTargets = [0, document, window];
        var maybeCStringToJsString = e => e > 2 ? UTF8ToString(e) : e;
        var findEventTarget = e => {
          e = maybeCStringToJsString(e);
          var r = specialHTMLTargets[e] || document.querySelector(e);
          return r;
        };
        var findCanvasEventTarget = findEventTarget;
        var _emscripten_get_canvas_element_size = (e, r, t) => {
          var n = findCanvasEventTarget(e);
          if (!n) {
            return -4;
          }
          HEAP32[r >> 2] = n.width;
          HEAP32[t >> 2] = n.height;
        };
        _emscripten_get_canvas_element_size.sig = "ippp";
        var getCanvasElementSize = e => {
          var r = stackSave();
          var t = stackAlloc(8);
          var n = t + 4;
          var a = stringToUTF8OnStack(e.id);
          var o = _emscripten_get_canvas_element_size(a, t, n);
          var l = [HEAP32[t >> 2], HEAP32[n >> 2]];
          stackRestore(r);
          return l;
        };
        var _emscripten_set_canvas_element_size = (e, r, t) => {
          var n = findCanvasEventTarget(e);
          if (n) {
            n.width = r;
            n.height = t;
            return 0;
          } else {
            return -4;
          }
        };
        _emscripten_set_canvas_element_size.sig = "ipii";
        var setCanvasElementSize = (e, r, t) => {
          if (!e.controlTransferredOffscreen) {
            e.width = r;
            e.height = t;
          } else {
            var n = stackSave();
            var a = stringToUTF8OnStack(e.id);
            _emscripten_set_canvas_element_size(a, r, t);
            stackRestore(n);
          }
        };
        var currentFullscreenStrategy = {};
        var registerRestoreOldStyle = e => {
          var r = getCanvasElementSize(e);
          var t = r[0];
          var n = r[1];
          var a = e.style.width;
          var o = e.style.height;
          var l = e.style.backgroundColor;
          var c = document.body.style.backgroundColor;
          var _ = e.style.paddingLeft;
          var u = e.style.paddingRight;
          var m = e.style.paddingTop;
          var f = e.style.paddingBottom;
          var v = e.style.marginLeft;
          var g = e.style.marginRight;
          var h = e.style.marginTop;
          var p = e.style.marginBottom;
          var b = document.body.style.margin;
          var S = document.documentElement.style.overflow;
          var w = document.body.scroll;
          var A = e.style.imageRendering;
          function k() {
            if (!getFullscreenElement()) {
              document.removeEventListener("fullscreenchange", k);
              document.removeEventListener("webkitfullscreenchange", k);
              setCanvasElementSize(e, t, n);
              e.style.width = a;
              e.style.height = o;
              e.style.backgroundColor = l;
              if (!c) {
                document.body.style.backgroundColor = "white";
              }
              document.body.style.backgroundColor = c;
              e.style.paddingLeft = _;
              e.style.paddingRight = u;
              e.style.paddingTop = m;
              e.style.paddingBottom = f;
              e.style.marginLeft = v;
              e.style.marginRight = g;
              e.style.marginTop = h;
              e.style.marginBottom = p;
              document.body.style.margin = b;
              document.documentElement.style.overflow = S;
              document.body.scroll = w;
              e.style.imageRendering = A;
              if (e.GLctxObject) {
                e.GLctxObject.GLctx.viewport(0, 0, t, n);
              }
              if (currentFullscreenStrategy.canvasResizedCallback) {
                getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(37, 0, currentFullscreenStrategy.canvasResizedCallbackUserData);
              }
            }
          }
          document.addEventListener("fullscreenchange", k);
          document.addEventListener("webkitfullscreenchange", k);
          return k;
        };
        var setLetterbox = (e, r, t) => {
          e.style.paddingLeft = e.style.paddingRight = t + "px";
          e.style.paddingTop = e.style.paddingBottom = r + "px";
        };
        var getBoundingClientRect = e => specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
          left: 0,
          top: 0
        };
        var JSEvents_resizeCanvasForFullscreen = (e, r) => {
          var a = registerRestoreOldStyle(e);
          var o = r.softFullscreen ? innerWidth : screen.width;
          var l = r.softFullscreen ? innerHeight : screen.height;
          var c = getBoundingClientRect(e);
          var _ = c.width;
          var u = c.height;
          var m = getCanvasElementSize(e);
          var f = m[0];
          var v = m[1];
          if (r.scaleMode == 3) {
            setLetterbox(e, (l - u) / 2, (o - _) / 2);
            o = _;
            l = u;
          } else if (r.scaleMode == 2) {
            if (o * v < f * l) {
              var g = v * o / f;
              setLetterbox(e, (l - g) / 2, 0);
              l = g;
            } else {
              var h = f * l / v;
              setLetterbox(e, 0, (o - h) / 2);
              o = h;
            }
          }
          e.style.backgroundColor ||= "black";
          document.body.style.backgroundColor ||= "black";
          e.style.width = o + "px";
          e.style.height = l + "px";
          if (r.filteringMode == 1) {
            e.style.imageRendering = "optimizeSpeed";
            e.style.imageRendering = "-moz-crisp-edges";
            e.style.imageRendering = "-o-crisp-edges";
            e.style.imageRendering = "-webkit-optimize-contrast";
            e.style.imageRendering = "optimize-contrast";
            e.style.imageRendering = "crisp-edges";
            e.style.imageRendering = "pixelated";
          }
          var p = r.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1;
          if (r.canvasResolutionScaleMode != 0) {
            var b = o * p | 0;
            var S = l * p | 0;
            setCanvasElementSize(e, b, S);
            if (e.GLctxObject) {
              e.GLctxObject.GLctx.viewport(0, 0, b, S);
            }
          }
          return a;
        };
        var JSEvents_requestFullscreen = (e, r) => {
          if (r.scaleMode != 0 || r.canvasResolutionScaleMode != 0) {
            JSEvents_resizeCanvasForFullscreen(e, r);
          }
          if (e.requestFullscreen) {
            e.requestFullscreen();
          } else if (e.webkitRequestFullscreen) {
            e.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
          } else if (JSEvents.fullscreenEnabled()) {
            return -3;
          } else {
            return -1;
          }
          currentFullscreenStrategy = r;
          if (r.canvasResizedCallback) {
            getWasmTableEntry(r.canvasResizedCallback)(37, 0, r.canvasResizedCallbackUserData);
          }
          return 0;
        };
        var _emscripten_exit_fullscreen = () => {
          if (!JSEvents.fullscreenEnabled()) {
            return -1;
          }
          JSEvents.removeDeferredCalls(JSEvents_requestFullscreen);
          var e = specialHTMLTargets[1];
          if (e.exitFullscreen) {
            if (e.fullscreenElement) {
              e.exitFullscreen();
            }
          } else if (e.webkitExitFullscreen) {
            if (e.webkitFullscreenElement) {
              e.webkitExitFullscreen();
            }
          } else {
            return -1;
          }
          return 0;
        };
        _emscripten_exit_fullscreen.sig = "i";
        var requestPointerLock = e => {
          if (e.requestPointerLock) {
            e.requestPointerLock();
          } else if (document.body.requestPointerLock) {
            return -3;
          } else {
            return -1;
          }
          return 0;
        };
        var _emscripten_exit_pointerlock = () => {
          JSEvents.removeDeferredCalls(requestPointerLock);
          if (document.exitPointerLock) {
            document.exitPointerLock();
            return 0;
          } else {
            return -1;
          }
        };
        _emscripten_exit_pointerlock.sig = "i";
        var _emscripten_force_exit = e => {
          __emscripten_runtime_keepalive_clear();
          _exit(e);
        };
        _emscripten_force_exit.sig = "vi";
        var fillBatteryEventData = (e, r) => {
          HEAPF64[e >> 3] = r.chargingTime;
          HEAPF64[e + 8 >> 3] = r.dischargingTime;
          HEAPF64[e + 16 >> 3] = r.level;
          HEAP8[e + 24] = r.charging;
        };
        var hasBatteryAPI = () => globalThis.navigator?.getBattery;
        var batteryManager;
        var _emscripten_get_battery_status = e => hasBatteryAPI() ? batteryManager ? (fillBatteryEventData(e, batteryManager), 0) : (navigator.getBattery().then(r => {
          batteryManager = r;
        }), -7) : -1;
        _emscripten_get_battery_status.sig = "ip";
        var _emscripten_get_device_pixel_ratio = () => devicePixelRatio;
        _emscripten_get_device_pixel_ratio.sig = "d";
        var _emscripten_get_element_css_size = (e, r, t) => {
          e = findEventTarget(e);
          if (!e) {
            return -4;
          }
          var n = getBoundingClientRect(e);
          HEAPF64[r >> 3] = n.width;
          HEAPF64[t >> 3] = n.height;
          return 0;
        };
        _emscripten_get_element_css_size.sig = "ippp";
        var fillGamepadEventData = (e, r) => {
          HEAPF64[e >> 3] = r.timestamp;
          for (var t = 0; t < r.axes.length; ++t) {
            HEAPF64[e + t * 8 + 16 >> 3] = r.axes[t];
          }
          for (var t = 0; t < r.buttons.length; ++t) {
            if (typeof r.buttons[t] == "object") {
              HEAPF64[e + t * 8 + 528 >> 3] = r.buttons[t].value;
            } else {
              HEAPF64[e + t * 8 + 528 >> 3] = r.buttons[t];
            }
          }
          for (var t = 0; t < r.buttons.length; ++t) {
            if (typeof r.buttons[t] == "object") {
              HEAP8[e + t + 1040] = r.buttons[t].pressed;
            } else {
              HEAP8[e + t + 1040] = r.buttons[t] == 1;
            }
          }
          HEAP8[e + 1104] = r.connected;
          HEAP32[e + 1108 >> 2] = r.index;
          HEAP32[e + 8 >> 2] = r.axes.length;
          HEAP32[e + 12 >> 2] = r.buttons.length;
          stringToUTF8(r.id, e + 1112, 64);
          stringToUTF8(r.mapping, e + 1176, 64);
        };
        var _emscripten_get_gamepad_status = (e, r) => e < 0 || e >= JSEvents.lastGamepadState.length ? -5 : JSEvents.lastGamepadState[e] ? (fillGamepadEventData(r, JSEvents.lastGamepadState[e]), 0) : -7;
        _emscripten_get_gamepad_status.sig = "iip";
        var getHeapMax = () => HEAPU8.length;
        var _emscripten_get_heap_max = () => getHeapMax();
        _emscripten_get_heap_max.sig = "p";
        var _emscripten_get_num_gamepads = () => JSEvents.lastGamepadState.length;
        _emscripten_get_num_gamepads.sig = "i";
        var _emscripten_get_screen_size = (e, r) => {
          HEAP32[e >> 2] = screen.width;
          HEAP32[r >> 2] = screen.height;
        };
        _emscripten_get_screen_size.sig = "vpp";
        var _emscripten_glActiveTexture = e => GLctx.activeTexture(e);
        _emscripten_glActiveTexture.sig = "vi";
        var _emscripten_glAttachShader = (e, r) => {
          GLctx.attachShader(GL.programs[e], GL.shaders[r]);
        };
        _emscripten_glAttachShader.sig = "vii";
        var _emscripten_glBeginQuery = (e, r) => {
          GLctx.beginQuery(e, GL.queries[r]);
        };
        _emscripten_glBeginQuery.sig = "vii";
        var _emscripten_glBeginQueryEXT = (e, r) => {
          GLctx.disjointTimerQueryExt.beginQueryEXT(e, GL.queries[r]);
        };
        _emscripten_glBeginQueryEXT.sig = "vii";
        var _emscripten_glBeginTransformFeedback = e => GLctx.beginTransformFeedback(e);
        _emscripten_glBeginTransformFeedback.sig = "vi";
        var _emscripten_glBindAttribLocation = (e, r, t) => {
          GLctx.bindAttribLocation(GL.programs[e], r, UTF8ToString(t));
        };
        _emscripten_glBindAttribLocation.sig = "viip";
        var _emscripten_glBindBuffer = (e, r) => {
          if (r && !GL.buffers[r]) {
            var t = GLctx.createBuffer();
            t.name = r;
            GL.buffers[r] = t;
          }
          if (e == 34962) {
            GLctx.currentArrayBufferBinding = r;
          } else if (e == 34963) {
            GLctx.currentElementArrayBufferBinding = r;
          }
          if (e == 35051) {
            GLctx.currentPixelPackBufferBinding = r;
          } else if (e == 35052) {
            GLctx.currentPixelUnpackBufferBinding = r;
          }
          GLctx.bindBuffer(e, GL.buffers[r]);
        };
        _emscripten_glBindBuffer.sig = "vii";
        var _emscripten_glBindBufferBase = (e, r, t) => {
          GLctx.bindBufferBase(e, r, GL.buffers[t]);
        };
        _emscripten_glBindBufferBase.sig = "viii";
        var _emscripten_glBindBufferRange = (e, r, t, n, a) => {
          GLctx.bindBufferRange(e, r, GL.buffers[t], n, a);
        };
        _emscripten_glBindBufferRange.sig = "viiipp";
        var _emscripten_glBindFramebuffer = (e, r) => {
          GLctx.bindFramebuffer(e, GL.framebuffers[r]);
        };
        _emscripten_glBindFramebuffer.sig = "vii";
        var _emscripten_glBindRenderbuffer = (e, r) => {
          GLctx.bindRenderbuffer(e, GL.renderbuffers[r]);
        };
        _emscripten_glBindRenderbuffer.sig = "vii";
        var _emscripten_glBindSampler = (e, r) => {
          GLctx.bindSampler(e, GL.samplers[r]);
        };
        _emscripten_glBindSampler.sig = "vii";
        var _emscripten_glBindTexture = (e, r) => {
          GLctx.bindTexture(e, GL.textures[r]);
        };
        _emscripten_glBindTexture.sig = "vii";
        var _emscripten_glBindTransformFeedback = (e, r) => {
          GLctx.bindTransformFeedback(e, GL.transformFeedbacks[r]);
        };
        _emscripten_glBindTransformFeedback.sig = "vii";
        var _emscripten_glBindVertexArray = e => {
          GLctx.bindVertexArray(GL.vaos[e]);
          var r = GLctx.getParameter(34965);
          GLctx.currentElementArrayBufferBinding = r ? r.name | 0 : 0;
        };
        _emscripten_glBindVertexArray.sig = "vi";
        var _glBindVertexArray = _emscripten_glBindVertexArray;
        _glBindVertexArray.sig = "vi";
        var _emscripten_glBindVertexArrayOES = _glBindVertexArray;
        _emscripten_glBindVertexArrayOES.sig = "vi";
        var _emscripten_glBlendColor = (e, r, t, n) => GLctx.blendColor(e, r, t, n);
        _emscripten_glBlendColor.sig = "vffff";
        var _emscripten_glBlendEquation = e => GLctx.blendEquation(e);
        _emscripten_glBlendEquation.sig = "vi";
        var _emscripten_glBlendEquationSeparate = (e, r) => GLctx.blendEquationSeparate(e, r);
        _emscripten_glBlendEquationSeparate.sig = "vii";
        var _emscripten_glBlendFunc = (e, r) => GLctx.blendFunc(e, r);
        _emscripten_glBlendFunc.sig = "vii";
        var _emscripten_glBlendFuncSeparate = (e, r, t, n) => GLctx.blendFuncSeparate(e, r, t, n);
        _emscripten_glBlendFuncSeparate.sig = "viiii";
        var _emscripten_glBlitFramebuffer = (e, r, t, n, a, o, l, c, _, u) => GLctx.blitFramebuffer(e, r, t, n, a, o, l, c, _, u);
        _emscripten_glBlitFramebuffer.sig = "viiiiiiiiii";
        var _emscripten_glBufferData = (e, r, t, n) => {
          if (t && r) {
            GLctx.bufferData(e, HEAPU8, n, t, r);
          } else {
            GLctx.bufferData(e, r, n);
          }
        };
        _emscripten_glBufferData.sig = "vippi";
        var _emscripten_glBufferSubData = (e, r, t, n) => {
          if (t) {
            GLctx.bufferSubData(e, r, HEAPU8, n, t);
          }
        };
        _emscripten_glBufferSubData.sig = "vippp";
        var _emscripten_glCheckFramebufferStatus = e => GLctx.checkFramebufferStatus(e);
        _emscripten_glCheckFramebufferStatus.sig = "ii";
        var _emscripten_glClear = e => GLctx.clear(e);
        _emscripten_glClear.sig = "vi";
        var _emscripten_glClearBufferfi = (e, r, t, n) => GLctx.clearBufferfi(e, r, t, n);
        _emscripten_glClearBufferfi.sig = "viifi";
        var _emscripten_glClearBufferfv = (e, r, t) => {
          GLctx.clearBufferfv(e, r, HEAPF32, t >> 2);
        };
        _emscripten_glClearBufferfv.sig = "viip";
        var _emscripten_glClearBufferiv = (e, r, t) => {
          GLctx.clearBufferiv(e, r, HEAP32, t >> 2);
        };
        _emscripten_glClearBufferiv.sig = "viip";
        var _emscripten_glClearBufferuiv = (e, r, t) => {
          GLctx.clearBufferuiv(e, r, HEAPU32, t >> 2);
        };
        _emscripten_glClearBufferuiv.sig = "viip";
        var _emscripten_glClearColor = (e, r, t, n) => GLctx.clearColor(e, r, t, n);
        _emscripten_glClearColor.sig = "vffff";
        var _emscripten_glClearDepthf = e => GLctx.clearDepth(e);
        _emscripten_glClearDepthf.sig = "vf";
        var _emscripten_glClearStencil = e => GLctx.clearStencil(e);
        _emscripten_glClearStencil.sig = "vi";
        var _emscripten_glClientWaitSync = (e, r, t) => {
          t = Number(t);
          return GLctx.clientWaitSync(GL.syncs[e], r, t);
        };
        _emscripten_glClientWaitSync.sig = "ipij";
        var _emscripten_glClipControlEXT = (e, r) => {
          GLctx.extClipControl.clipControlEXT(e, r);
        };
        _emscripten_glClipControlEXT.sig = "vii";
        var _emscripten_glColorMask = (e, r, t, n) => {
          GLctx.colorMask(!!e, !!r, !!t, !!n);
        };
        _emscripten_glColorMask.sig = "viiii";
        var _emscripten_glCompileShader = e => {
          GLctx.compileShader(GL.shaders[e]);
        };
        _emscripten_glCompileShader.sig = "vi";
        var _emscripten_glCompressedTexImage2D = (e, r, t, n, a, o, l, c) => {
          if (GLctx.currentPixelUnpackBufferBinding || !l) {
            GLctx.compressedTexImage2D(e, r, t, n, a, o, l, c);
            return;
          }
          GLctx.compressedTexImage2D(e, r, t, n, a, o, HEAPU8, c, l);
        };
        _emscripten_glCompressedTexImage2D.sig = "viiiiiiip";
        var _emscripten_glCompressedTexImage3D = (e, r, t, n, a, o, l, c, _) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.compressedTexImage3D(e, r, t, n, a, o, l, c, _);
          } else {
            GLctx.compressedTexImage3D(e, r, t, n, a, o, l, HEAPU8, _, c);
          }
        };
        _emscripten_glCompressedTexImage3D.sig = "viiiiiiiip";
        var _emscripten_glCompressedTexSubImage2D = (e, r, t, n, a, o, l, c, _) => {
          if (GLctx.currentPixelUnpackBufferBinding || !c) {
            GLctx.compressedTexSubImage2D(e, r, t, n, a, o, l, c, _);
            return;
          }
          GLctx.compressedTexSubImage2D(e, r, t, n, a, o, l, HEAPU8, _, c);
        };
        _emscripten_glCompressedTexSubImage2D.sig = "viiiiiiiip";
        var _emscripten_glCompressedTexSubImage3D = (e, r, t, n, a, o, l, c, _, u, m) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.compressedTexSubImage3D(e, r, t, n, a, o, l, c, _, u, m);
          } else {
            GLctx.compressedTexSubImage3D(e, r, t, n, a, o, l, c, _, HEAPU8, m, u);
          }
        };
        _emscripten_glCompressedTexSubImage3D.sig = "viiiiiiiiiip";
        var _emscripten_glCopyBufferSubData = (e, r, t, n, a) => GLctx.copyBufferSubData(e, r, t, n, a);
        _emscripten_glCopyBufferSubData.sig = "viippp";
        var _emscripten_glCopyTexImage2D = (e, r, t, n, a, o, l, c) => GLctx.copyTexImage2D(e, r, t, n, a, o, l, c);
        _emscripten_glCopyTexImage2D.sig = "viiiiiiii";
        var _emscripten_glCopyTexSubImage2D = (e, r, t, n, a, o, l, c) => GLctx.copyTexSubImage2D(e, r, t, n, a, o, l, c);
        _emscripten_glCopyTexSubImage2D.sig = "viiiiiiii";
        var _emscripten_glCopyTexSubImage3D = (e, r, t, n, a, o, l, c, _) => GLctx.copyTexSubImage3D(e, r, t, n, a, o, l, c, _);
        _emscripten_glCopyTexSubImage3D.sig = "viiiiiiiii";
        var _emscripten_glCreateProgram = () => {
          var e = GL.getNewId(GL.programs);
          var r = GLctx.createProgram();
          r.name = e;
          r.maxUniformLength = r.maxAttributeLength = r.maxUniformBlockNameLength = 0;
          r.uniformIdCounter = 1;
          GL.programs[e] = r;
          return e;
        };
        _emscripten_glCreateProgram.sig = "i";
        var _emscripten_glCreateShader = e => {
          var r = GL.getNewId(GL.shaders);
          GL.shaders[r] = GLctx.createShader(e);
          return r;
        };
        _emscripten_glCreateShader.sig = "ii";
        var _emscripten_glCullFace = e => GLctx.cullFace(e);
        _emscripten_glCullFace.sig = "vi";
        var _emscripten_glDeleteBuffers = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.buffers[n];
            if (a) {
              GLctx.deleteBuffer(a);
              a.name = 0;
              GL.buffers[n] = null;
              if (n == GLctx.currentArrayBufferBinding) {
                GLctx.currentArrayBufferBinding = 0;
              }
              if (n == GLctx.currentElementArrayBufferBinding) {
                GLctx.currentElementArrayBufferBinding = 0;
              }
              if (n == GLctx.currentPixelPackBufferBinding) {
                GLctx.currentPixelPackBufferBinding = 0;
              }
              if (n == GLctx.currentPixelUnpackBufferBinding) {
                GLctx.currentPixelUnpackBufferBinding = 0;
              }
            }
          }
        };
        _emscripten_glDeleteBuffers.sig = "vip";
        var _emscripten_glDeleteFramebuffers = (e, r) => {
          for (var t = 0; t < e; ++t) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.framebuffers[n];
            if (a) {
              GLctx.deleteFramebuffer(a);
              a.name = 0;
              GL.framebuffers[n] = null;
            }
          }
        };
        _emscripten_glDeleteFramebuffers.sig = "vip";
        var _emscripten_glDeleteProgram = e => {
          if (e) {
            var r = GL.programs[e];
            if (!r) {
              GL.recordError(1281);
              return;
            }
            GLctx.deleteProgram(r);
            r.name = 0;
            GL.programs[e] = null;
          }
        };
        _emscripten_glDeleteProgram.sig = "vi";
        var _emscripten_glDeleteQueries = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.queries[n];
            if (a) {
              GLctx.deleteQuery(a);
              GL.queries[n] = null;
            }
          }
        };
        _emscripten_glDeleteQueries.sig = "vip";
        var _emscripten_glDeleteQueriesEXT = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.queries[n];
            if (a) {
              GLctx.disjointTimerQueryExt.deleteQueryEXT(a);
              GL.queries[n] = null;
            }
          }
        };
        _emscripten_glDeleteQueriesEXT.sig = "vip";
        var _emscripten_glDeleteRenderbuffers = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.renderbuffers[n];
            if (a) {
              GLctx.deleteRenderbuffer(a);
              a.name = 0;
              GL.renderbuffers[n] = null;
            }
          }
        };
        _emscripten_glDeleteRenderbuffers.sig = "vip";
        var _emscripten_glDeleteSamplers = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.samplers[n];
            if (a) {
              GLctx.deleteSampler(a);
              a.name = 0;
              GL.samplers[n] = null;
            }
          }
        };
        _emscripten_glDeleteSamplers.sig = "vip";
        var _emscripten_glDeleteShader = e => {
          if (e) {
            var r = GL.shaders[e];
            if (!r) {
              GL.recordError(1281);
              return;
            }
            GLctx.deleteShader(r);
            GL.shaders[e] = null;
          }
        };
        _emscripten_glDeleteShader.sig = "vi";
        var _emscripten_glDeleteSync = e => {
          if (e) {
            var r = GL.syncs[e];
            if (!r) {
              GL.recordError(1281);
              return;
            }
            GLctx.deleteSync(r);
            r.name = 0;
            GL.syncs[e] = null;
          }
        };
        _emscripten_glDeleteSync.sig = "vp";
        var _emscripten_glDeleteTextures = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.textures[n];
            if (a) {
              GLctx.deleteTexture(a);
              a.name = 0;
              GL.textures[n] = null;
            }
          }
        };
        _emscripten_glDeleteTextures.sig = "vip";
        var _emscripten_glDeleteTransformFeedbacks = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            var a = GL.transformFeedbacks[n];
            if (a) {
              GLctx.deleteTransformFeedback(a);
              a.name = 0;
              GL.transformFeedbacks[n] = null;
            }
          }
        };
        _emscripten_glDeleteTransformFeedbacks.sig = "vip";
        var _emscripten_glDeleteVertexArrays = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = HEAP32[r + t * 4 >> 2];
            GLctx.deleteVertexArray(GL.vaos[n]);
            GL.vaos[n] = null;
          }
        };
        _emscripten_glDeleteVertexArrays.sig = "vip";
        var _glDeleteVertexArrays = _emscripten_glDeleteVertexArrays;
        _glDeleteVertexArrays.sig = "vip";
        var _emscripten_glDeleteVertexArraysOES = _glDeleteVertexArrays;
        _emscripten_glDeleteVertexArraysOES.sig = "vip";
        var _emscripten_glDepthFunc = e => GLctx.depthFunc(e);
        _emscripten_glDepthFunc.sig = "vi";
        var _emscripten_glDepthMask = e => {
          GLctx.depthMask(!!e);
        };
        _emscripten_glDepthMask.sig = "vi";
        var _emscripten_glDepthRangef = (e, r) => GLctx.depthRange(e, r);
        _emscripten_glDepthRangef.sig = "vff";
        var _emscripten_glDetachShader = (e, r) => {
          GLctx.detachShader(GL.programs[e], GL.shaders[r]);
        };
        _emscripten_glDetachShader.sig = "vii";
        var _emscripten_glDisable = e => GLctx.disable(e);
        _emscripten_glDisable.sig = "vi";
        var _emscripten_glDisableVertexAttribArray = e => {
          var r = GL.currentContext.clientBuffers[e];
          r.enabled = false;
          GLctx.disableVertexAttribArray(e);
        };
        _emscripten_glDisableVertexAttribArray.sig = "vi";
        var _emscripten_glDrawArrays = (e, r, t) => {
          GL.preDrawHandleClientVertexAttribBindings(r + t);
          GLctx.drawArrays(e, r, t);
          GL.postDrawHandleClientVertexAttribBindings();
        };
        _emscripten_glDrawArrays.sig = "viii";
        var _emscripten_glDrawArraysInstanced = (e, r, t, n) => {
          GLctx.drawArraysInstanced(e, r, t, n);
        };
        _emscripten_glDrawArraysInstanced.sig = "viiii";
        var _glDrawArraysInstanced = _emscripten_glDrawArraysInstanced;
        _glDrawArraysInstanced.sig = "viiii";
        var _emscripten_glDrawArraysInstancedANGLE = _glDrawArraysInstanced;
        var _emscripten_glDrawArraysInstancedARB = _glDrawArraysInstanced;
        var _emscripten_glDrawArraysInstancedEXT = _glDrawArraysInstanced;
        var _emscripten_glDrawArraysInstancedNV = _glDrawArraysInstanced;
        var tempFixedLengthArray = [];
        var _emscripten_glDrawBuffers = (e, r) => {
          var t = tempFixedLengthArray[e];
          for (var n = 0; n < e; n++) {
            t[n] = HEAP32[r + n * 4 >> 2];
          }
          GLctx.drawBuffers(t);
        };
        _emscripten_glDrawBuffers.sig = "vip";
        var _glDrawBuffers = _emscripten_glDrawBuffers;
        _glDrawBuffers.sig = "vip";
        var _emscripten_glDrawBuffersEXT = _glDrawBuffers;
        var _emscripten_glDrawBuffersWEBGL = _glDrawBuffers;
        var _emscripten_glDrawElements = (e, r, t, n) => {
          var a;
          var o = 0;
          if (!GLctx.currentElementArrayBufferBinding) {
            var l = GL.calcBufLength(1, t, 0, r);
            a = GL.getTempIndexBuffer(l);
            GLctx.bindBuffer(34963, a);
            GLctx.bufferSubData(34963, 0, HEAPU8.subarray(n, n + l));
            if (r > 0) {
              for (var c = 0; c < GL.currentContext.maxVertexAttribs; ++c) {
                var _ = GL.currentContext.clientBuffers[c];
                if (_.clientside && _.enabled) {
                  let u;
                  switch (t) {
                    case 5121:
                      u = Uint8Array;
                      break;
                    case 5123:
                      u = Uint16Array;
                      break;
                    default:
                      GL.recordError(1282);
                      return;
                  }
                  o = new u(HEAPU8.buffer, n, r).reduce((m, f) => Math.max(m, f)) + 1;
                  break;
                }
              }
            }
            n = 0;
          }
          GL.preDrawHandleClientVertexAttribBindings(o);
          GLctx.drawElements(e, r, t, n);
          GL.postDrawHandleClientVertexAttribBindings(r);
          if (!GLctx.currentElementArrayBufferBinding) {
            GLctx.bindBuffer(34963, null);
          }
        };
        _emscripten_glDrawElements.sig = "viiip";
        var _emscripten_glDrawElementsInstanced = (e, r, t, n, a) => {
          GLctx.drawElementsInstanced(e, r, t, n, a);
        };
        _emscripten_glDrawElementsInstanced.sig = "viiipi";
        var _glDrawElementsInstanced = _emscripten_glDrawElementsInstanced;
        _glDrawElementsInstanced.sig = "viiipi";
        var _emscripten_glDrawElementsInstancedANGLE = _glDrawElementsInstanced;
        var _emscripten_glDrawElementsInstancedARB = _glDrawElementsInstanced;
        var _emscripten_glDrawElementsInstancedEXT = _glDrawElementsInstanced;
        var _emscripten_glDrawElementsInstancedNV = _glDrawElementsInstanced;
        var _glDrawElements = _emscripten_glDrawElements;
        _glDrawElements.sig = "viiip";
        var _emscripten_glDrawRangeElements = (e, r, t, n, a, o) => {
          _glDrawElements(e, n, a, o);
        };
        _emscripten_glDrawRangeElements.sig = "viiiiip";
        var _emscripten_glEnable = e => GLctx.enable(e);
        _emscripten_glEnable.sig = "vi";
        var _emscripten_glEnableVertexAttribArray = e => {
          var r = GL.currentContext.clientBuffers[e];
          r.enabled = true;
          GLctx.enableVertexAttribArray(e);
        };
        _emscripten_glEnableVertexAttribArray.sig = "vi";
        var _emscripten_glEndQuery = e => GLctx.endQuery(e);
        _emscripten_glEndQuery.sig = "vi";
        var _emscripten_glEndQueryEXT = e => {
          GLctx.disjointTimerQueryExt.endQueryEXT(e);
        };
        _emscripten_glEndQueryEXT.sig = "vi";
        var _emscripten_glEndTransformFeedback = () => GLctx.endTransformFeedback();
        _emscripten_glEndTransformFeedback.sig = "v";
        var _emscripten_glFenceSync = (e, r) => {
          var t = GLctx.fenceSync(e, r);
          if (t) {
            var n = GL.getNewId(GL.syncs);
            t.name = n;
            GL.syncs[n] = t;
            return n;
          }
          return 0;
        };
        _emscripten_glFenceSync.sig = "pii";
        var _emscripten_glFinish = () => GLctx.finish();
        _emscripten_glFinish.sig = "v";
        var _emscripten_glFlush = () => GLctx.flush();
        _emscripten_glFlush.sig = "v";
        var _emscripten_glFramebufferRenderbuffer = (e, r, t, n) => {
          GLctx.framebufferRenderbuffer(e, r, t, GL.renderbuffers[n]);
        };
        _emscripten_glFramebufferRenderbuffer.sig = "viiii";
        var _emscripten_glFramebufferTexture2D = (e, r, t, n, a) => {
          GLctx.framebufferTexture2D(e, r, t, GL.textures[n], a);
        };
        _emscripten_glFramebufferTexture2D.sig = "viiiii";
        var _emscripten_glFramebufferTextureLayer = (e, r, t, n, a) => {
          GLctx.framebufferTextureLayer(e, r, GL.textures[t], n, a);
        };
        _emscripten_glFramebufferTextureLayer.sig = "viiiii";
        var _emscripten_glFrontFace = e => GLctx.frontFace(e);
        _emscripten_glFrontFace.sig = "vi";
        var _emscripten_glGenBuffers = (e, r) => {
          GL.genObject(e, r, "createBuffer", GL.buffers);
        };
        _emscripten_glGenBuffers.sig = "vip";
        var _emscripten_glGenFramebuffers = (e, r) => {
          GL.genObject(e, r, "createFramebuffer", GL.framebuffers);
        };
        _emscripten_glGenFramebuffers.sig = "vip";
        var _emscripten_glGenQueries = (e, r) => {
          GL.genObject(e, r, "createQuery", GL.queries);
        };
        _emscripten_glGenQueries.sig = "vip";
        var _emscripten_glGenQueriesEXT = (e, r) => {
          for (var t = 0; t < e; t++) {
            var n = GLctx.disjointTimerQueryExt.createQueryEXT();
            if (!n) {
              for (GL.recordError(1282); t < e;) {
                HEAP32[r + t++ * 4 >> 2] = 0;
              }
              return;
            }
            var a = GL.getNewId(GL.queries);
            n.name = a;
            GL.queries[a] = n;
            HEAP32[r + t * 4 >> 2] = a;
          }
        };
        _emscripten_glGenQueriesEXT.sig = "vip";
        var _emscripten_glGenRenderbuffers = (e, r) => {
          GL.genObject(e, r, "createRenderbuffer", GL.renderbuffers);
        };
        _emscripten_glGenRenderbuffers.sig = "vip";
        var _emscripten_glGenSamplers = (e, r) => {
          GL.genObject(e, r, "createSampler", GL.samplers);
        };
        _emscripten_glGenSamplers.sig = "vip";
        var _emscripten_glGenTextures = (e, r) => {
          GL.genObject(e, r, "createTexture", GL.textures);
        };
        _emscripten_glGenTextures.sig = "vip";
        var _emscripten_glGenTransformFeedbacks = (e, r) => {
          GL.genObject(e, r, "createTransformFeedback", GL.transformFeedbacks);
        };
        _emscripten_glGenTransformFeedbacks.sig = "vip";
        var _emscripten_glGenVertexArrays = (e, r) => {
          GL.genObject(e, r, "createVertexArray", GL.vaos);
        };
        _emscripten_glGenVertexArrays.sig = "vip";
        var _glGenVertexArrays = _emscripten_glGenVertexArrays;
        _glGenVertexArrays.sig = "vip";
        var _emscripten_glGenVertexArraysOES = _glGenVertexArrays;
        _emscripten_glGenVertexArraysOES.sig = "vip";
        var _emscripten_glGenerateMipmap = e => GLctx.generateMipmap(e);
        _emscripten_glGenerateMipmap.sig = "vi";
        var __glGetActiveAttribOrUniform = (e, r, t, n, a, o, l, c) => {
          r = GL.programs[r];
          var _ = GLctx[e](r, t);
          if (_) {
            var u = c && stringToUTF8(_.name, c, n);
            if (a) {
              HEAP32[a >> 2] = u;
            }
            if (o) {
              HEAP32[o >> 2] = _.size;
            }
            if (l) {
              HEAP32[l >> 2] = _.type;
            }
          }
        };
        var _emscripten_glGetActiveAttrib = (e, r, t, n, a, o, l) => __glGetActiveAttribOrUniform("getActiveAttrib", e, r, t, n, a, o, l);
        _emscripten_glGetActiveAttrib.sig = "viiipppp";
        var _emscripten_glGetActiveUniform = (e, r, t, n, a, o, l) => __glGetActiveAttribOrUniform("getActiveUniform", e, r, t, n, a, o, l);
        _emscripten_glGetActiveUniform.sig = "viiipppp";
        var _emscripten_glGetActiveUniformBlockName = (e, r, t, n, a) => {
          e = GL.programs[e];
          var o = GLctx.getActiveUniformBlockName(e, r);
          if (o) {
            if (a && t > 0) {
              var l = stringToUTF8(o, a, t);
              if (n) {
                HEAP32[n >> 2] = l;
              }
            } else if (n) {
              HEAP32[n >> 2] = 0;
            }
          }
        };
        _emscripten_glGetActiveUniformBlockName.sig = "viiipp";
        var _emscripten_glGetActiveUniformBlockiv = (e, r, t, n) => {
          if (!n) {
            GL.recordError(1281);
            return;
          }
          e = GL.programs[e];
          if (t == 35393) {
            var a = GLctx.getActiveUniformBlockName(e, r);
            HEAP32[n >> 2] = a.length + 1;
            return;
          }
          var o = GLctx.getActiveUniformBlockParameter(e, r, t);
          if (o !== null) {
            if (t == 35395) {
              for (var l = 0; l < o.length; l++) {
                HEAP32[n + l * 4 >> 2] = o[l];
              }
            } else {
              HEAP32[n >> 2] = o;
            }
          }
        };
        _emscripten_glGetActiveUniformBlockiv.sig = "viiip";
        var _emscripten_glGetActiveUniformsiv = (e, r, t, n, a) => {
          if (!a) {
            GL.recordError(1281);
            return;
          }
          if (r > 0 && t == 0) {
            GL.recordError(1281);
            return;
          }
          e = GL.programs[e];
          var o = [];
          for (var l = 0; l < r; l++) {
            o.push(HEAP32[t + l * 4 >> 2]);
          }
          var c = GLctx.getActiveUniforms(e, o, n);
          if (c) {
            for (var _ = c.length, l = 0; l < _; l++) {
              HEAP32[a + l * 4 >> 2] = c[l];
            }
          }
        };
        _emscripten_glGetActiveUniformsiv.sig = "viipip";
        var _emscripten_glGetAttachedShaders = (e, r, t, n) => {
          var a = GLctx.getAttachedShaders(GL.programs[e]);
          var o = a.length;
          if (o > r) {
            o = r;
          }
          HEAP32[t >> 2] = o;
          for (var l = 0; l < o; ++l) {
            var c = GL.shaders.indexOf(a[l]);
            HEAP32[n + l * 4 >> 2] = c;
          }
        };
        _emscripten_glGetAttachedShaders.sig = "viipp";
        var _emscripten_glGetAttribLocation = (e, r) => GLctx.getAttribLocation(GL.programs[e], UTF8ToString(r));
        _emscripten_glGetAttribLocation.sig = "iip";
        var writeI53ToI64 = (e, r) => {
          HEAPU32[e >> 2] = r;
          var t = HEAPU32[e >> 2];
          HEAPU32[e + 4 >> 2] = (r - t) / 4294967296;
        };
        var webglGetExtensions = () => {
          var e = getEmscriptenSupportedExtensions(GLctx);
          e = e.concat(e.map(r => "GL_" + r));
          return e;
        };
        var emscriptenWebGLGet = (e, r, t) => {
          if (!r) {
            GL.recordError(1281);
            return;
          }
          var n = undefined;
          switch (e) {
            case 36346:
              n = 1;
              break;
            case 36344:
              if (t != 0 && t != 1) {
                GL.recordError(1280);
              }
              return;
            case 34814:
            case 36345:
              n = 0;
              break;
            case 34466:
              var a = GLctx.getParameter(34467);
              n = a ? a.length : 0;
              break;
            case 33309:
              if (GL.currentContext.version < 2) {
                GL.recordError(1282);
                return;
              }
              n = webglGetExtensions().length;
              break;
            case 33307:
            case 33308:
              if (GL.currentContext.version < 2) {
                GL.recordError(1280);
                return;
              }
              n = e == 33307 ? 3 : 0;
              break;
          }
          if (n === undefined) {
            var o = GLctx.getParameter(e);
            switch (typeof o) {
              case "number":
                n = o;
                break;
              case "boolean":
                n = o ? 1 : 0;
                break;
              case "string":
                GL.recordError(1280);
                return;
              case "object":
                if (o === null) {
                  switch (e) {
                    case 34964:
                    case 35725:
                    case 34965:
                    case 36006:
                    case 36007:
                    case 32873:
                    case 34229:
                    case 36662:
                    case 36663:
                    case 35053:
                    case 35055:
                    case 36010:
                    case 35097:
                    case 35869:
                    case 32874:
                    case 36389:
                    case 35983:
                    case 35368:
                    case 34068:
                      {
                        n = 0;
                        break;
                      }
                    default:
                      {
                        GL.recordError(1280);
                        return;
                      }
                  }
                } else if (o instanceof Float32Array || o instanceof Uint32Array || o instanceof Int32Array || o instanceof Array) {
                  for (var l = 0; l < o.length; ++l) {
                    switch (t) {
                      case 0:
                        HEAP32[r + l * 4 >> 2] = o[l];
                        break;
                      case 2:
                        HEAPF32[r + l * 4 >> 2] = o[l];
                        break;
                      case 4:
                        HEAP8[r + l] = o[l] ? 1 : 0;
                        break;
                    }
                  }
                  return;
                } else {
                  try {
                    n = o.name | 0;
                  } catch (c) {
                    GL.recordError(1280);
                    err(`GL_INVALID_ENUM in glGet${t}v: Unknown object returned from WebGL getParameter(${e})! (error: ${c})`);
                    return;
                  }
                }
                break;
              default:
                GL.recordError(1280);
                err(`GL_INVALID_ENUM in glGet${t}v: Native code calling glGet${t}v(${e}) and it returns ${o} of type ${typeof o}!`);
                return;
            }
          }
          switch (t) {
            case 1:
              writeI53ToI64(r, n);
              break;
            case 0:
              HEAP32[r >> 2] = n;
              break;
            case 2:
              HEAPF32[r >> 2] = n;
              break;
            case 4:
              HEAP8[r] = n ? 1 : 0;
              break;
          }
        };
        var _emscripten_glGetBooleanv = (e, r) => emscriptenWebGLGet(e, r, 4);
        _emscripten_glGetBooleanv.sig = "vip";
        var _emscripten_glGetBufferParameteri64v = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          writeI53ToI64(t, GLctx.getBufferParameter(e, r));
        };
        _emscripten_glGetBufferParameteri64v.sig = "viip";
        var _emscripten_glGetBufferParameteriv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.getBufferParameter(e, r);
        };
        _emscripten_glGetBufferParameteriv.sig = "viip";
        var _emscripten_glGetError = () => {
          var e = GLctx.getError() || GL.lastError;
          GL.lastError = 0;
          return e;
        };
        _emscripten_glGetError.sig = "i";
        var _emscripten_glGetFloatv = (e, r) => emscriptenWebGLGet(e, r, 2);
        _emscripten_glGetFloatv.sig = "vip";
        var _emscripten_glGetFragDataLocation = (e, r) => GLctx.getFragDataLocation(GL.programs[e], UTF8ToString(r));
        _emscripten_glGetFragDataLocation.sig = "iip";
        var _emscripten_glGetFramebufferAttachmentParameteriv = (e, r, t, n) => {
          var a = GLctx.getFramebufferAttachmentParameter(e, r, t);
          if (a instanceof WebGLRenderbuffer || a instanceof WebGLTexture) {
            a = a.name | 0;
          }
          HEAP32[n >> 2] = a;
        };
        _emscripten_glGetFramebufferAttachmentParameteriv.sig = "viiip";
        var emscriptenWebGLGetIndexed = (e, r, t, n) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          var a = GLctx.getIndexedParameter(e, r);
          var o;
          switch (typeof a) {
            case "boolean":
              o = a ? 1 : 0;
              break;
            case "number":
              o = a;
              break;
            case "object":
              if (a === null) {
                switch (e) {
                  case 35983:
                  case 35368:
                    o = 0;
                    break;
                  default:
                    {
                      GL.recordError(1280);
                      return;
                    }
                }
              } else if (a instanceof WebGLBuffer) {
                o = a.name | 0;
              } else {
                GL.recordError(1280);
                return;
              }
              break;
            default:
              GL.recordError(1280);
              return;
          }
          switch (n) {
            case 1:
              writeI53ToI64(t, o);
              break;
            case 0:
              HEAP32[t >> 2] = o;
              break;
            case 2:
              HEAPF32[t >> 2] = o;
              break;
            case 4:
              HEAP8[t] = o ? 1 : 0;
              break;
            default:
              abort("internal emscriptenWebGLGetIndexed() error, bad type: " + n);
          }
        };
        var _emscripten_glGetInteger64i_v = (e, r, t) => emscriptenWebGLGetIndexed(e, r, t, 1);
        _emscripten_glGetInteger64i_v.sig = "viip";
        var _emscripten_glGetInteger64v = (e, r) => {
          emscriptenWebGLGet(e, r, 1);
        };
        _emscripten_glGetInteger64v.sig = "vip";
        var _emscripten_glGetIntegeri_v = (e, r, t) => emscriptenWebGLGetIndexed(e, r, t, 0);
        _emscripten_glGetIntegeri_v.sig = "viip";
        var _emscripten_glGetIntegerv = (e, r) => emscriptenWebGLGet(e, r, 0);
        _emscripten_glGetIntegerv.sig = "vip";
        var _emscripten_glGetInternalformativ = (e, r, t, n, a) => {
          if (n < 0) {
            GL.recordError(1281);
            return;
          }
          if (!a) {
            GL.recordError(1281);
            return;
          }
          var o = GLctx.getInternalformatParameter(e, r, t);
          if (o !== null) {
            for (var l = 0; l < o.length && l < n; ++l) {
              HEAP32[a + l * 4 >> 2] = o[l];
            }
          }
        };
        _emscripten_glGetInternalformativ.sig = "viiiip";
        var _emscripten_glGetProgramBinary = (e, r, t, n, a) => {
          GL.recordError(1282);
        };
        _emscripten_glGetProgramBinary.sig = "viippp";
        var _emscripten_glGetProgramInfoLog = (e, r, t, n) => {
          var a = GLctx.getProgramInfoLog(GL.programs[e]);
          if (a === null) {
            a = "(unknown error)";
          }
          var o = r > 0 && n ? stringToUTF8(a, n, r) : 0;
          if (t) {
            HEAP32[t >> 2] = o;
          }
        };
        _emscripten_glGetProgramInfoLog.sig = "viipp";
        var _emscripten_glGetProgramiv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          if (e >= GL.counter) {
            GL.recordError(1281);
            return;
          }
          e = GL.programs[e];
          if (r == 35716) {
            var n = GLctx.getProgramInfoLog(e);
            if (n === null) {
              n = "(unknown error)";
            }
            HEAP32[t >> 2] = n.length + 1;
          } else if (r == 35719) {
            if (!e.maxUniformLength) {
              for (var a = GLctx.getProgramParameter(e, 35718), o = 0; o < a; ++o) {
                e.maxUniformLength = Math.max(e.maxUniformLength, GLctx.getActiveUniform(e, o).name.length + 1);
              }
            }
            HEAP32[t >> 2] = e.maxUniformLength;
          } else if (r == 35722) {
            if (!e.maxAttributeLength) {
              for (var l = GLctx.getProgramParameter(e, 35721), o = 0; o < l; ++o) {
                e.maxAttributeLength = Math.max(e.maxAttributeLength, GLctx.getActiveAttrib(e, o).name.length + 1);
              }
            }
            HEAP32[t >> 2] = e.maxAttributeLength;
          } else if (r == 35381) {
            if (!e.maxUniformBlockNameLength) {
              for (var c = GLctx.getProgramParameter(e, 35382), o = 0; o < c; ++o) {
                e.maxUniformBlockNameLength = Math.max(e.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(e, o).length + 1);
              }
            }
            HEAP32[t >> 2] = e.maxUniformBlockNameLength;
          } else {
            HEAP32[t >> 2] = GLctx.getProgramParameter(e, r);
          }
        };
        _emscripten_glGetProgramiv.sig = "viip";
        var _emscripten_glGetQueryObjecti64vEXT = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          var n = GL.queries[e];
          var a;
          if (GL.currentContext.version < 2) {
            a = GLctx.disjointTimerQueryExt.getQueryObjectEXT(n, r);
          } else {
            a = GLctx.getQueryParameter(n, r);
          }
          var o;
          if (typeof a == "boolean") {
            o = a ? 1 : 0;
          } else {
            o = a;
          }
          writeI53ToI64(t, o);
        };
        _emscripten_glGetQueryObjecti64vEXT.sig = "viip";
        var _emscripten_glGetQueryObjectivEXT = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          var n = GL.queries[e];
          var a = GLctx.disjointTimerQueryExt.getQueryObjectEXT(n, r);
          var o;
          if (typeof a == "boolean") {
            o = a ? 1 : 0;
          } else {
            o = a;
          }
          HEAP32[t >> 2] = o;
        };
        _emscripten_glGetQueryObjectivEXT.sig = "viip";
        var _glGetQueryObjecti64vEXT = _emscripten_glGetQueryObjecti64vEXT;
        var _emscripten_glGetQueryObjectui64vEXT = _glGetQueryObjecti64vEXT;
        var _emscripten_glGetQueryObjectuiv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          var n = GL.queries[e];
          var a = GLctx.getQueryParameter(n, r);
          var o;
          if (typeof a == "boolean") {
            o = a ? 1 : 0;
          } else {
            o = a;
          }
          HEAP32[t >> 2] = o;
        };
        _emscripten_glGetQueryObjectuiv.sig = "viip";
        var _glGetQueryObjectivEXT = _emscripten_glGetQueryObjectivEXT;
        var _emscripten_glGetQueryObjectuivEXT = _glGetQueryObjectivEXT;
        var _emscripten_glGetQueryiv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.getQuery(e, r);
        };
        _emscripten_glGetQueryiv.sig = "viip";
        var _emscripten_glGetQueryivEXT = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.disjointTimerQueryExt.getQueryEXT(e, r);
        };
        _emscripten_glGetQueryivEXT.sig = "viip";
        var _emscripten_glGetRenderbufferParameteriv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.getRenderbufferParameter(e, r);
        };
        _emscripten_glGetRenderbufferParameteriv.sig = "viip";
        var _emscripten_glGetSamplerParameterfv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAPF32[t >> 2] = GLctx.getSamplerParameter(GL.samplers[e], r);
        };
        _emscripten_glGetSamplerParameterfv.sig = "viip";
        var _emscripten_glGetSamplerParameteriv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.getSamplerParameter(GL.samplers[e], r);
        };
        _emscripten_glGetSamplerParameteriv.sig = "viip";
        var _emscripten_glGetShaderInfoLog = (e, r, t, n) => {
          var a = GLctx.getShaderInfoLog(GL.shaders[e]);
          if (a === null) {
            a = "(unknown error)";
          }
          var o = r > 0 && n ? stringToUTF8(a, n, r) : 0;
          if (t) {
            HEAP32[t >> 2] = o;
          }
        };
        _emscripten_glGetShaderInfoLog.sig = "viipp";
        var _emscripten_glGetShaderPrecisionFormat = (e, r, t, n) => {
          var a = GLctx.getShaderPrecisionFormat(e, r);
          HEAP32[t >> 2] = a.rangeMin;
          HEAP32[t + 4 >> 2] = a.rangeMax;
          HEAP32[n >> 2] = a.precision;
        };
        _emscripten_glGetShaderPrecisionFormat.sig = "viipp";
        var _emscripten_glGetShaderSource = (e, r, t, n) => {
          var a = GLctx.getShaderSource(GL.shaders[e]);
          if (a) {
            var o = r > 0 && n ? stringToUTF8(a, n, r) : 0;
            if (t) {
              HEAP32[t >> 2] = o;
            }
          }
        };
        _emscripten_glGetShaderSource.sig = "viipp";
        var _emscripten_glGetShaderiv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          if (r == 35716) {
            var n = GLctx.getShaderInfoLog(GL.shaders[e]);
            if (n === null) {
              n = "(unknown error)";
            }
            var a = n ? n.length + 1 : 0;
            HEAP32[t >> 2] = a;
          } else if (r == 35720) {
            var o = GLctx.getShaderSource(GL.shaders[e]);
            var l = o ? o.length + 1 : 0;
            HEAP32[t >> 2] = l;
          } else {
            HEAP32[t >> 2] = GLctx.getShaderParameter(GL.shaders[e], r);
          }
        };
        _emscripten_glGetShaderiv.sig = "viip";
        var _emscripten_glGetString = e => {
          var r = GL.stringCache[e];
          if (!r) {
            switch (e) {
              case 7939:
                r = stringToNewUTF8(webglGetExtensions().join(" "));
                break;
              case 7936:
              case 7937:
              case 37445:
              case 37446:
                var t = GLctx.getParameter(e);
                if (!t) {
                  GL.recordError(1280);
                }
                r = t ? stringToNewUTF8(t) : 0;
                break;
              case 7938:
                var n = GLctx.getParameter(7938);
                var a = `OpenGL ES 2.0 (${n})`;
                a = `OpenGL ES 3.0 (${n})`;
                r = stringToNewUTF8(a);
                break;
              case 35724:
                var o = GLctx.getParameter(35724);
                var l = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
                var c = o.match(l);
                if (c !== null) {
                  if (c[1].length == 3) {
                    c[1] = c[1] + "0";
                  }
                  o = `OpenGL ES GLSL ES ${c[1]} (${o})`;
                }
                r = stringToNewUTF8(o);
                break;
              default:
                GL.recordError(1280);
            }
            GL.stringCache[e] = r;
          }
          return r;
        };
        _emscripten_glGetString.sig = "pi";
        var _emscripten_glGetStringi = (e, r) => {
          if (GL.currentContext.version < 2) {
            GL.recordError(1282);
            return 0;
          }
          var t = GL.stringiCache[e];
          if (t) {
            if (r < 0 || r >= t.length) {
              GL.recordError(1281);
              return 0;
            } else {
              return t[r];
            }
          }
          if (e === 7939) {
            var n = webglGetExtensions().map(stringToNewUTF8);
            t = GL.stringiCache[e] = n;
            if (r < 0 || r >= t.length) {
              GL.recordError(1281);
              return 0;
            } else {
              return t[r];
            }
          } else {
            GL.recordError(1280);
            return 0;
          }
        };
        _emscripten_glGetStringi.sig = "pii";
        var _emscripten_glGetSynciv = (e, r, t, n, a) => {
          if (t < 0) {
            GL.recordError(1281);
            return;
          }
          if (!a) {
            GL.recordError(1281);
            return;
          }
          var o = GLctx.getSyncParameter(GL.syncs[e], r);
          if (o !== null) {
            HEAP32[a >> 2] = o;
            if (n) {
              HEAP32[n >> 2] = 1;
            }
          }
        };
        _emscripten_glGetSynciv.sig = "vpiipp";
        var _emscripten_glGetTexParameterfv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAPF32[t >> 2] = GLctx.getTexParameter(e, r);
        };
        _emscripten_glGetTexParameterfv.sig = "viip";
        var _emscripten_glGetTexParameteriv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          HEAP32[t >> 2] = GLctx.getTexParameter(e, r);
        };
        _emscripten_glGetTexParameteriv.sig = "viip";
        var _emscripten_glGetTransformFeedbackVarying = (e, r, t, n, a, o, l) => {
          e = GL.programs[e];
          var c = GLctx.getTransformFeedbackVarying(e, r);
          if (c) {
            if (l && t > 0) {
              var _ = stringToUTF8(c.name, l, t);
              if (n) {
                HEAP32[n >> 2] = _;
              }
            } else if (n) {
              HEAP32[n >> 2] = 0;
            }
            if (a) {
              HEAP32[a >> 2] = c.size;
            }
            if (o) {
              HEAP32[o >> 2] = c.type;
            }
          }
        };
        _emscripten_glGetTransformFeedbackVarying.sig = "viiipppp";
        var _emscripten_glGetUniformBlockIndex = (e, r) => GLctx.getUniformBlockIndex(GL.programs[e], UTF8ToString(r));
        _emscripten_glGetUniformBlockIndex.sig = "iip";
        var _emscripten_glGetUniformIndices = (e, r, t, n) => {
          if (!n) {
            GL.recordError(1281);
            return;
          }
          if (r > 0 && (t == 0 || n == 0)) {
            GL.recordError(1281);
            return;
          }
          e = GL.programs[e];
          var a = [];
          for (var o = 0; o < r; o++) {
            a.push(UTF8ToString(HEAPU32[t + o * 4 >> 2]));
          }
          var l = GLctx.getUniformIndices(e, a);
          if (l) {
            for (var c = l.length, o = 0; o < c; o++) {
              HEAP32[n + o * 4 >> 2] = l[o];
            }
          }
        };
        _emscripten_glGetUniformIndices.sig = "viipp";
        var jstoi_q = e => parseInt(e);
        var webglGetLeftBracePos = e => e.slice(-1) == "]" && e.lastIndexOf("[");
        var webglPrepareUniformLocationsBeforeFirstUse = e => {
          var r = e.uniformLocsById;
          var t = e.uniformSizeAndIdsByName;
          var n;
          var a;
          if (!r) {
            e.uniformLocsById = r = {};
            e.uniformArrayNamesById = {};
            var o = GLctx.getProgramParameter(e, 35718);
            for (n = 0; n < o; ++n) {
              var l = GLctx.getActiveUniform(e, n);
              var c = l.name;
              var _ = l.size;
              var u = webglGetLeftBracePos(c);
              var m = u > 0 ? c.slice(0, u) : c;
              var f = e.uniformIdCounter;
              e.uniformIdCounter += _;
              t[m] = [_, f];
              a = 0;
              for (; a < _; ++a) {
                r[f] = a;
                e.uniformArrayNamesById[f++] = m;
              }
            }
          }
        };
        var _emscripten_glGetUniformLocation = (e, r) => {
          r = UTF8ToString(r);
          if (e = GL.programs[e]) {
            webglPrepareUniformLocationsBeforeFirstUse(e);
            var t = e.uniformLocsById;
            var n = 0;
            var a = r;
            var o = webglGetLeftBracePos(r);
            if (o > 0) {
              n = jstoi_q(r.slice(o + 1)) >>> 0;
              a = r.slice(0, o);
            }
            var l = e.uniformSizeAndIdsByName[a];
            if (l && n < l[0] && (n += l[1], t[n] = t[n] || GLctx.getUniformLocation(e, r))) {
              return n;
            }
          } else {
            GL.recordError(1281);
          }
          return -1;
        };
        _emscripten_glGetUniformLocation.sig = "iip";
        var webglGetUniformLocation = e => {
          var r = GLctx.currentProgram;
          if (r) {
            var t = r.uniformLocsById[e];
            if (typeof t == "number") {
              r.uniformLocsById[e] = t = GLctx.getUniformLocation(r, r.uniformArrayNamesById[e] + (t > 0 ? `[${t}]` : ""));
            }
            return t;
          } else {
            GL.recordError(1282);
          }
        };
        var emscriptenWebGLGetUniform = (e, r, t, n) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          e = GL.programs[e];
          webglPrepareUniformLocationsBeforeFirstUse(e);
          var a = GLctx.getUniform(e, webglGetUniformLocation(r));
          if (typeof a == "number" || typeof a == "boolean") {
            switch (n) {
              case 0:
                HEAP32[t >> 2] = a;
                break;
              case 2:
                HEAPF32[t >> 2] = a;
                break;
            }
          } else {
            for (var o = 0; o < a.length; o++) {
              switch (n) {
                case 0:
                  HEAP32[t + o * 4 >> 2] = a[o];
                  break;
                case 2:
                  HEAPF32[t + o * 4 >> 2] = a[o];
                  break;
              }
            }
          }
        };
        var _emscripten_glGetUniformfv = (e, r, t) => {
          emscriptenWebGLGetUniform(e, r, t, 2);
        };
        _emscripten_glGetUniformfv.sig = "viip";
        var _emscripten_glGetUniformiv = (e, r, t) => {
          emscriptenWebGLGetUniform(e, r, t, 0);
        };
        _emscripten_glGetUniformiv.sig = "viip";
        var _emscripten_glGetUniformuiv = (e, r, t) => emscriptenWebGLGetUniform(e, r, t, 0);
        _emscripten_glGetUniformuiv.sig = "viip";
        var emscriptenWebGLGetVertexAttrib = (e, r, t, n) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          if (GL.currentContext.clientBuffers[e].enabled) {
            err("glGetVertexAttrib*v on client-side array: not supported, bad data returned");
          }
          var a = GLctx.getVertexAttrib(e, r);
          if (r == 34975) {
            HEAP32[t >> 2] = a && a.name;
          } else if (typeof a == "number" || typeof a == "boolean") {
            switch (n) {
              case 0:
                HEAP32[t >> 2] = a;
                break;
              case 2:
                HEAPF32[t >> 2] = a;
                break;
              case 5:
                HEAP32[t >> 2] = Math.fround(a);
                break;
            }
          } else {
            for (var o = 0; o < a.length; o++) {
              switch (n) {
                case 0:
                  HEAP32[t + o * 4 >> 2] = a[o];
                  break;
                case 2:
                  HEAPF32[t + o * 4 >> 2] = a[o];
                  break;
                case 5:
                  HEAP32[t + o * 4 >> 2] = Math.fround(a[o]);
                  break;
              }
            }
          }
        };
        var _emscripten_glGetVertexAttribIiv = (e, r, t) => {
          emscriptenWebGLGetVertexAttrib(e, r, t, 0);
        };
        _emscripten_glGetVertexAttribIiv.sig = "viip";
        var _glGetVertexAttribIiv = _emscripten_glGetVertexAttribIiv;
        _glGetVertexAttribIiv.sig = "viip";
        var _emscripten_glGetVertexAttribIuiv = _glGetVertexAttribIiv;
        _emscripten_glGetVertexAttribIuiv.sig = "viip";
        var _emscripten_glGetVertexAttribPointerv = (e, r, t) => {
          if (!t) {
            GL.recordError(1281);
            return;
          }
          if (GL.currentContext.clientBuffers[e].enabled) {
            err("glGetVertexAttribPointer on client-side array: not supported, bad data returned");
          }
          HEAP32[t >> 2] = GLctx.getVertexAttribOffset(e, r);
        };
        _emscripten_glGetVertexAttribPointerv.sig = "viip";
        var _emscripten_glGetVertexAttribfv = (e, r, t) => {
          emscriptenWebGLGetVertexAttrib(e, r, t, 2);
        };
        _emscripten_glGetVertexAttribfv.sig = "viip";
        var _emscripten_glGetVertexAttribiv = (e, r, t) => {
          emscriptenWebGLGetVertexAttrib(e, r, t, 5);
        };
        _emscripten_glGetVertexAttribiv.sig = "viip";
        var _emscripten_glHint = (e, r) => GLctx.hint(e, r);
        _emscripten_glHint.sig = "vii";
        var _emscripten_glInvalidateFramebuffer = (e, r, t) => {
          var n = tempFixedLengthArray[r];
          for (var a = 0; a < r; a++) {
            n[a] = HEAP32[t + a * 4 >> 2];
          }
          GLctx.invalidateFramebuffer(e, n);
        };
        _emscripten_glInvalidateFramebuffer.sig = "viip";
        var _emscripten_glInvalidateSubFramebuffer = (e, r, t, n, a, o, l) => {
          var c = tempFixedLengthArray[r];
          for (var _ = 0; _ < r; _++) {
            c[_] = HEAP32[t + _ * 4 >> 2];
          }
          GLctx.invalidateSubFramebuffer(e, c, n, a, o, l);
        };
        _emscripten_glInvalidateSubFramebuffer.sig = "viipiiii";
        var _emscripten_glIsBuffer = e => {
          var r = GL.buffers[e];
          if (r) {
            return GLctx.isBuffer(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsBuffer.sig = "ii";
        var _emscripten_glIsEnabled = e => GLctx.isEnabled(e);
        _emscripten_glIsEnabled.sig = "ii";
        var _emscripten_glIsFramebuffer = e => {
          var r = GL.framebuffers[e];
          if (r) {
            return GLctx.isFramebuffer(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsFramebuffer.sig = "ii";
        var _emscripten_glIsProgram = e => {
          e = GL.programs[e];
          if (e) {
            return GLctx.isProgram(e);
          } else {
            return 0;
          }
        };
        _emscripten_glIsProgram.sig = "ii";
        var _emscripten_glIsQuery = e => {
          var r = GL.queries[e];
          if (r) {
            return GLctx.isQuery(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsQuery.sig = "ii";
        var _emscripten_glIsQueryEXT = e => {
          var r = GL.queries[e];
          if (r) {
            return GLctx.disjointTimerQueryExt.isQueryEXT(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsQueryEXT.sig = "ii";
        var _emscripten_glIsRenderbuffer = e => {
          var r = GL.renderbuffers[e];
          if (r) {
            return GLctx.isRenderbuffer(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsRenderbuffer.sig = "ii";
        var _emscripten_glIsSampler = e => {
          var r = GL.samplers[e];
          if (r) {
            return GLctx.isSampler(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsSampler.sig = "ii";
        var _emscripten_glIsShader = e => {
          var r = GL.shaders[e];
          if (r) {
            return GLctx.isShader(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsShader.sig = "ii";
        var _emscripten_glIsSync = e => GLctx.isSync(GL.syncs[e]);
        _emscripten_glIsSync.sig = "ip";
        var _emscripten_glIsTexture = e => {
          var r = GL.textures[e];
          if (r) {
            return GLctx.isTexture(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsTexture.sig = "ii";
        var _emscripten_glIsTransformFeedback = e => GLctx.isTransformFeedback(GL.transformFeedbacks[e]);
        _emscripten_glIsTransformFeedback.sig = "ii";
        var _emscripten_glIsVertexArray = e => {
          var r = GL.vaos[e];
          if (r) {
            return GLctx.isVertexArray(r);
          } else {
            return 0;
          }
        };
        _emscripten_glIsVertexArray.sig = "ii";
        var _glIsVertexArray = _emscripten_glIsVertexArray;
        _glIsVertexArray.sig = "ii";
        var _emscripten_glIsVertexArrayOES = _glIsVertexArray;
        _emscripten_glIsVertexArrayOES.sig = "ii";
        var _emscripten_glLineWidth = e => GLctx.lineWidth(e);
        _emscripten_glLineWidth.sig = "vf";
        var _emscripten_glLinkProgram = e => {
          e = GL.programs[e];
          GLctx.linkProgram(e);
          e.uniformLocsById = 0;
          e.uniformSizeAndIdsByName = {};
        };
        _emscripten_glLinkProgram.sig = "vi";
        var _emscripten_glPauseTransformFeedback = () => GLctx.pauseTransformFeedback();
        _emscripten_glPauseTransformFeedback.sig = "v";
        var _emscripten_glPixelStorei = (e, r) => {
          if (e == 3317) {
            GL.unpackAlignment = r;
          } else if (e == 3314) {
            GL.unpackRowLength = r;
          }
          GLctx.pixelStorei(e, r);
        };
        _emscripten_glPixelStorei.sig = "vii";
        var _emscripten_glPolygonModeWEBGL = (e, r) => {
          GLctx.webglPolygonMode.polygonModeWEBGL(e, r);
        };
        _emscripten_glPolygonModeWEBGL.sig = "vii";
        var _emscripten_glPolygonOffset = (e, r) => GLctx.polygonOffset(e, r);
        _emscripten_glPolygonOffset.sig = "vff";
        var _emscripten_glPolygonOffsetClampEXT = (e, r, t) => {
          GLctx.extPolygonOffsetClamp.polygonOffsetClampEXT(e, r, t);
        };
        _emscripten_glPolygonOffsetClampEXT.sig = "vfff";
        var _emscripten_glProgramBinary = (e, r, t, n) => {
          GL.recordError(1280);
        };
        _emscripten_glProgramBinary.sig = "viipi";
        var _emscripten_glProgramParameteri = (e, r, t) => {
          GL.recordError(1280);
        };
        _emscripten_glProgramParameteri.sig = "viii";
        var _emscripten_glQueryCounterEXT = (e, r) => {
          GLctx.disjointTimerQueryExt.queryCounterEXT(GL.queries[e], r);
        };
        _emscripten_glQueryCounterEXT.sig = "vii";
        var _emscripten_glReadBuffer = e => GLctx.readBuffer(e);
        _emscripten_glReadBuffer.sig = "vi";
        var heapObjectForWebGLType = e => {
          e -= 5120;
          if (e == 0) {
            return HEAP8;
          } else if (e == 1) {
            return HEAPU8;
          } else if (e == 2) {
            return HEAP16;
          } else if (e == 4) {
            return HEAP32;
          } else if (e == 6) {
            return HEAPF32;
          } else if (e == 5 || e == 28922 || e == 28520 || e == 30779 || e == 30782) {
            return HEAPU32;
          } else {
            return HEAPU16;
          }
        };
        var toTypedArrayIndex = (e, r) => e >>> 31 - Math.clz32(r.BYTES_PER_ELEMENT);
        var _emscripten_glReadPixels = (e, r, t, n, a, o, l) => {
          if (GLctx.currentPixelPackBufferBinding) {
            GLctx.readPixels(e, r, t, n, a, o, l);
            return;
          }
          var c = heapObjectForWebGLType(o);
          var _ = toTypedArrayIndex(l, c);
          GLctx.readPixels(e, r, t, n, a, o, c, _);
        };
        _emscripten_glReadPixels.sig = "viiiiiip";
        var _emscripten_glReleaseShaderCompiler = () => {};
        _emscripten_glReleaseShaderCompiler.sig = "v";
        var _emscripten_glRenderbufferStorage = (e, r, t, n) => GLctx.renderbufferStorage(e, r, t, n);
        _emscripten_glRenderbufferStorage.sig = "viiii";
        var _emscripten_glRenderbufferStorageMultisample = (e, r, t, n, a) => GLctx.renderbufferStorageMultisample(e, r, t, n, a);
        _emscripten_glRenderbufferStorageMultisample.sig = "viiiii";
        var _emscripten_glResumeTransformFeedback = () => GLctx.resumeTransformFeedback();
        _emscripten_glResumeTransformFeedback.sig = "v";
        var _emscripten_glSampleCoverage = (e, r) => {
          GLctx.sampleCoverage(e, !!r);
        };
        _emscripten_glSampleCoverage.sig = "vfi";
        var _emscripten_glSamplerParameterf = (e, r, t) => {
          GLctx.samplerParameterf(GL.samplers[e], r, t);
        };
        _emscripten_glSamplerParameterf.sig = "viif";
        var _emscripten_glSamplerParameterfv = (e, r, t) => {
          var n = HEAPF32[t >> 2];
          GLctx.samplerParameterf(GL.samplers[e], r, n);
        };
        _emscripten_glSamplerParameterfv.sig = "viip";
        var _emscripten_glSamplerParameteri = (e, r, t) => {
          GLctx.samplerParameteri(GL.samplers[e], r, t);
        };
        _emscripten_glSamplerParameteri.sig = "viii";
        var _emscripten_glSamplerParameteriv = (e, r, t) => {
          var n = HEAP32[t >> 2];
          GLctx.samplerParameteri(GL.samplers[e], r, n);
        };
        _emscripten_glSamplerParameteriv.sig = "viip";
        var _emscripten_glScissor = (e, r, t, n) => GLctx.scissor(e, r, t, n);
        _emscripten_glScissor.sig = "viiii";
        var _emscripten_glShaderBinary = (e, r, t, n, a) => {
          GL.recordError(1280);
        };
        _emscripten_glShaderBinary.sig = "vipipi";
        var _emscripten_glShaderSource = (e, r, t, n) => {
          var a = GL.getSource(e, r, t, n);
          GLctx.shaderSource(GL.shaders[e], a);
        };
        _emscripten_glShaderSource.sig = "viipp";
        var _emscripten_glStencilFunc = (e, r, t) => GLctx.stencilFunc(e, r, t);
        _emscripten_glStencilFunc.sig = "viii";
        var _emscripten_glStencilFuncSeparate = (e, r, t, n) => GLctx.stencilFuncSeparate(e, r, t, n);
        _emscripten_glStencilFuncSeparate.sig = "viiii";
        var _emscripten_glStencilMask = e => GLctx.stencilMask(e);
        _emscripten_glStencilMask.sig = "vi";
        var _emscripten_glStencilMaskSeparate = (e, r) => GLctx.stencilMaskSeparate(e, r);
        _emscripten_glStencilMaskSeparate.sig = "vii";
        var _emscripten_glStencilOp = (e, r, t) => GLctx.stencilOp(e, r, t);
        _emscripten_glStencilOp.sig = "viii";
        var _emscripten_glStencilOpSeparate = (e, r, t, n) => GLctx.stencilOpSeparate(e, r, t, n);
        _emscripten_glStencilOpSeparate.sig = "viiii";
        var computeUnpackAlignedImageSize = (e, r, t) => {
          function n(l, c) {
            return l + c - 1 & -c;
          }
          var a = (GL.unpackRowLength || e) * t;
          var o = n(a, GL.unpackAlignment);
          return r * o;
        };
        var colorChannelsInGlTextureFormat = e => {
          var r = {
            5: 3,
            6: 4,
            8: 2,
            29502: 3,
            29504: 4,
            26917: 2,
            26918: 2,
            29846: 3,
            29847: 4
          };
          return r[e - 6402] || 1;
        };
        var emscriptenWebGLGetTexPixelData = (e, r, t, n, a, o) => {
          var l = heapObjectForWebGLType(e);
          var c = colorChannelsInGlTextureFormat(r) * l.BYTES_PER_ELEMENT;
          var _ = computeUnpackAlignedImageSize(t, n, c);
          return l.subarray(toTypedArrayIndex(a, l), toTypedArrayIndex(a + _, l));
        };
        var _emscripten_glTexImage2D = (e, r, t, n, a, o, l, c, _) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.texImage2D(e, r, t, n, a, o, l, c, _);
            return;
          }
          if (_) {
            var u = heapObjectForWebGLType(c);
            var m = toTypedArrayIndex(_, u);
            GLctx.texImage2D(e, r, t, n, a, o, l, c, u, m);
            return;
          }
          var f = _ ? emscriptenWebGLGetTexPixelData(c, l, n, a, _, t) : null;
          GLctx.texImage2D(e, r, t, n, a, o, l, c, f);
        };
        _emscripten_glTexImage2D.sig = "viiiiiiiip";
        var _emscripten_glTexImage3D = (e, r, t, n, a, o, l, c, _, u) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.texImage3D(e, r, t, n, a, o, l, c, _, u);
          } else if (u) {
            var m = heapObjectForWebGLType(_);
            GLctx.texImage3D(e, r, t, n, a, o, l, c, _, m, toTypedArrayIndex(u, m));
          } else {
            GLctx.texImage3D(e, r, t, n, a, o, l, c, _, null);
          }
        };
        _emscripten_glTexImage3D.sig = "viiiiiiiiip";
        var _emscripten_glTexParameterf = (e, r, t) => GLctx.texParameterf(e, r, t);
        _emscripten_glTexParameterf.sig = "viif";
        var _emscripten_glTexParameterfv = (e, r, t) => {
          var n = HEAPF32[t >> 2];
          GLctx.texParameterf(e, r, n);
        };
        _emscripten_glTexParameterfv.sig = "viip";
        var _emscripten_glTexParameteri = (e, r, t) => GLctx.texParameteri(e, r, t);
        _emscripten_glTexParameteri.sig = "viii";
        var _emscripten_glTexParameteriv = (e, r, t) => {
          var n = HEAP32[t >> 2];
          GLctx.texParameteri(e, r, n);
        };
        _emscripten_glTexParameteriv.sig = "viip";
        var _emscripten_glTexStorage2D = (e, r, t, n, a) => GLctx.texStorage2D(e, r, t, n, a);
        _emscripten_glTexStorage2D.sig = "viiiii";
        var _emscripten_glTexStorage3D = (e, r, t, n, a, o) => GLctx.texStorage3D(e, r, t, n, a, o);
        _emscripten_glTexStorage3D.sig = "viiiiii";
        var _emscripten_glTexSubImage2D = (e, r, t, n, a, o, l, c, _) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.texSubImage2D(e, r, t, n, a, o, l, c, _);
            return;
          }
          if (_) {
            var u = heapObjectForWebGLType(c);
            GLctx.texSubImage2D(e, r, t, n, a, o, l, c, u, toTypedArrayIndex(_, u));
            return;
          }
          var m = _ ? emscriptenWebGLGetTexPixelData(c, l, a, o, _, 0) : null;
          GLctx.texSubImage2D(e, r, t, n, a, o, l, c, m);
        };
        _emscripten_glTexSubImage2D.sig = "viiiiiiiip";
        var _emscripten_glTexSubImage3D = (e, r, t, n, a, o, l, c, _, u, m) => {
          if (GLctx.currentPixelUnpackBufferBinding) {
            GLctx.texSubImage3D(e, r, t, n, a, o, l, c, _, u, m);
          } else if (m) {
            var f = heapObjectForWebGLType(u);
            GLctx.texSubImage3D(e, r, t, n, a, o, l, c, _, u, f, toTypedArrayIndex(m, f));
          } else {
            GLctx.texSubImage3D(e, r, t, n, a, o, l, c, _, u, null);
          }
        };
        _emscripten_glTexSubImage3D.sig = "viiiiiiiiiip";
        var _emscripten_glTransformFeedbackVaryings = (e, r, t, n) => {
          e = GL.programs[e];
          var a = [];
          for (var o = 0; o < r; o++) {
            a.push(UTF8ToString(HEAPU32[t + o * 4 >> 2]));
          }
          GLctx.transformFeedbackVaryings(e, a, n);
        };
        _emscripten_glTransformFeedbackVaryings.sig = "viipi";
        var _emscripten_glUniform1f = (e, r) => {
          GLctx.uniform1f(webglGetUniformLocation(e), r);
        };
        _emscripten_glUniform1f.sig = "vif";
        var _emscripten_glUniform1fv = (e, r, t) => {
          if (r) {
            GLctx.uniform1fv(webglGetUniformLocation(e), HEAPF32, t >> 2, r);
          }
        };
        _emscripten_glUniform1fv.sig = "viip";
        var _emscripten_glUniform1i = (e, r) => {
          GLctx.uniform1i(webglGetUniformLocation(e), r);
        };
        _emscripten_glUniform1i.sig = "vii";
        var _emscripten_glUniform1iv = (e, r, t) => {
          if (r) {
            GLctx.uniform1iv(webglGetUniformLocation(e), HEAP32, t >> 2, r);
          }
        };
        _emscripten_glUniform1iv.sig = "viip";
        var _emscripten_glUniform1ui = (e, r) => {
          GLctx.uniform1ui(webglGetUniformLocation(e), r);
        };
        _emscripten_glUniform1ui.sig = "vii";
        var _emscripten_glUniform1uiv = (e, r, t) => {
          if (r) {
            GLctx.uniform1uiv(webglGetUniformLocation(e), HEAPU32, t >> 2, r);
          }
        };
        _emscripten_glUniform1uiv.sig = "viip";
        var _emscripten_glUniform2f = (e, r, t) => {
          GLctx.uniform2f(webglGetUniformLocation(e), r, t);
        };
        _emscripten_glUniform2f.sig = "viff";
        var _emscripten_glUniform2fv = (e, r, t) => {
          if (r) {
            GLctx.uniform2fv(webglGetUniformLocation(e), HEAPF32, t >> 2, r * 2);
          }
        };
        _emscripten_glUniform2fv.sig = "viip";
        var _emscripten_glUniform2i = (e, r, t) => {
          GLctx.uniform2i(webglGetUniformLocation(e), r, t);
        };
        _emscripten_glUniform2i.sig = "viii";
        var _emscripten_glUniform2iv = (e, r, t) => {
          if (r) {
            GLctx.uniform2iv(webglGetUniformLocation(e), HEAP32, t >> 2, r * 2);
          }
        };
        _emscripten_glUniform2iv.sig = "viip";
        var _emscripten_glUniform2ui = (e, r, t) => {
          GLctx.uniform2ui(webglGetUniformLocation(e), r, t);
        };
        _emscripten_glUniform2ui.sig = "viii";
        var _emscripten_glUniform2uiv = (e, r, t) => {
          if (r) {
            GLctx.uniform2uiv(webglGetUniformLocation(e), HEAPU32, t >> 2, r * 2);
          }
        };
        _emscripten_glUniform2uiv.sig = "viip";
        var _emscripten_glUniform3f = (e, r, t, n) => {
          GLctx.uniform3f(webglGetUniformLocation(e), r, t, n);
        };
        _emscripten_glUniform3f.sig = "vifff";
        var _emscripten_glUniform3fv = (e, r, t) => {
          if (r) {
            GLctx.uniform3fv(webglGetUniformLocation(e), HEAPF32, t >> 2, r * 3);
          }
        };
        _emscripten_glUniform3fv.sig = "viip";
        var _emscripten_glUniform3i = (e, r, t, n) => {
          GLctx.uniform3i(webglGetUniformLocation(e), r, t, n);
        };
        _emscripten_glUniform3i.sig = "viiii";
        var _emscripten_glUniform3iv = (e, r, t) => {
          if (r) {
            GLctx.uniform3iv(webglGetUniformLocation(e), HEAP32, t >> 2, r * 3);
          }
        };
        _emscripten_glUniform3iv.sig = "viip";
        var _emscripten_glUniform3ui = (e, r, t, n) => {
          GLctx.uniform3ui(webglGetUniformLocation(e), r, t, n);
        };
        _emscripten_glUniform3ui.sig = "viiii";
        var _emscripten_glUniform3uiv = (e, r, t) => {
          if (r) {
            GLctx.uniform3uiv(webglGetUniformLocation(e), HEAPU32, t >> 2, r * 3);
          }
        };
        _emscripten_glUniform3uiv.sig = "viip";
        var _emscripten_glUniform4f = (e, r, t, n, a) => {
          GLctx.uniform4f(webglGetUniformLocation(e), r, t, n, a);
        };
        _emscripten_glUniform4f.sig = "viffff";
        var _emscripten_glUniform4fv = (e, r, t) => {
          if (r) {
            GLctx.uniform4fv(webglGetUniformLocation(e), HEAPF32, t >> 2, r * 4);
          }
        };
        _emscripten_glUniform4fv.sig = "viip";
        var _emscripten_glUniform4i = (e, r, t, n, a) => {
          GLctx.uniform4i(webglGetUniformLocation(e), r, t, n, a);
        };
        _emscripten_glUniform4i.sig = "viiiii";
        var _emscripten_glUniform4iv = (e, r, t) => {
          if (r) {
            GLctx.uniform4iv(webglGetUniformLocation(e), HEAP32, t >> 2, r * 4);
          }
        };
        _emscripten_glUniform4iv.sig = "viip";
        var _emscripten_glUniform4ui = (e, r, t, n, a) => {
          GLctx.uniform4ui(webglGetUniformLocation(e), r, t, n, a);
        };
        _emscripten_glUniform4ui.sig = "viiiii";
        var _emscripten_glUniform4uiv = (e, r, t) => {
          if (r) {
            GLctx.uniform4uiv(webglGetUniformLocation(e), HEAPU32, t >> 2, r * 4);
          }
        };
        _emscripten_glUniform4uiv.sig = "viip";
        var _emscripten_glUniformBlockBinding = (e, r, t) => {
          e = GL.programs[e];
          GLctx.uniformBlockBinding(e, r, t);
        };
        _emscripten_glUniformBlockBinding.sig = "viii";
        var _emscripten_glUniformMatrix2fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix2fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 4);
          }
        };
        _emscripten_glUniformMatrix2fv.sig = "viiip";
        var _emscripten_glUniformMatrix2x3fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix2x3fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 6);
          }
        };
        _emscripten_glUniformMatrix2x3fv.sig = "viiip";
        var _emscripten_glUniformMatrix2x4fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix2x4fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 8);
          }
        };
        _emscripten_glUniformMatrix2x4fv.sig = "viiip";
        var _emscripten_glUniformMatrix3fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix3fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 9);
          }
        };
        _emscripten_glUniformMatrix3fv.sig = "viiip";
        var _emscripten_glUniformMatrix3x2fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix3x2fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 6);
          }
        };
        _emscripten_glUniformMatrix3x2fv.sig = "viiip";
        var _emscripten_glUniformMatrix3x4fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix3x4fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 12);
          }
        };
        _emscripten_glUniformMatrix3x4fv.sig = "viiip";
        var _emscripten_glUniformMatrix4fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix4fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 16);
          }
        };
        _emscripten_glUniformMatrix4fv.sig = "viiip";
        var _emscripten_glUniformMatrix4x2fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix4x2fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 8);
          }
        };
        _emscripten_glUniformMatrix4x2fv.sig = "viiip";
        var _emscripten_glUniformMatrix4x3fv = (e, r, t, n) => {
          if (r) {
            GLctx.uniformMatrix4x3fv(webglGetUniformLocation(e), !!t, HEAPF32, n >> 2, r * 12);
          }
        };
        _emscripten_glUniformMatrix4x3fv.sig = "viiip";
        var _emscripten_glUseProgram = e => {
          e = GL.programs[e];
          GLctx.useProgram(e);
          GLctx.currentProgram = e;
        };
        _emscripten_glUseProgram.sig = "vi";
        var _emscripten_glValidateProgram = e => {
          GLctx.validateProgram(GL.programs[e]);
        };
        _emscripten_glValidateProgram.sig = "vi";
        var _emscripten_glVertexAttrib1f = (e, r) => GLctx.vertexAttrib1f(e, r);
        _emscripten_glVertexAttrib1f.sig = "vif";
        var _emscripten_glVertexAttrib1fv = (e, r) => {
          GLctx.vertexAttrib1f(e, HEAPF32[r >> 2]);
        };
        _emscripten_glVertexAttrib1fv.sig = "vip";
        var _emscripten_glVertexAttrib2f = (e, r, t) => GLctx.vertexAttrib2f(e, r, t);
        _emscripten_glVertexAttrib2f.sig = "viff";
        var _emscripten_glVertexAttrib2fv = (e, r) => {
          GLctx.vertexAttrib2f(e, HEAPF32[r >> 2], HEAPF32[r + 4 >> 2]);
        };
        _emscripten_glVertexAttrib2fv.sig = "vip";
        var _emscripten_glVertexAttrib3f = (e, r, t, n) => GLctx.vertexAttrib3f(e, r, t, n);
        _emscripten_glVertexAttrib3f.sig = "vifff";
        var _emscripten_glVertexAttrib3fv = (e, r) => {
          GLctx.vertexAttrib3f(e, HEAPF32[r >> 2], HEAPF32[r + 4 >> 2], HEAPF32[r + 8 >> 2]);
        };
        _emscripten_glVertexAttrib3fv.sig = "vip";
        var _emscripten_glVertexAttrib4f = (e, r, t, n, a) => GLctx.vertexAttrib4f(e, r, t, n, a);
        _emscripten_glVertexAttrib4f.sig = "viffff";
        var _emscripten_glVertexAttrib4fv = (e, r) => {
          GLctx.vertexAttrib4f(e, HEAPF32[r >> 2], HEAPF32[r + 4 >> 2], HEAPF32[r + 8 >> 2], HEAPF32[r + 12 >> 2]);
        };
        _emscripten_glVertexAttrib4fv.sig = "vip";
        var _emscripten_glVertexAttribDivisor = (e, r) => {
          GLctx.vertexAttribDivisor(e, r);
        };
        _emscripten_glVertexAttribDivisor.sig = "vii";
        var _glVertexAttribDivisor = _emscripten_glVertexAttribDivisor;
        _glVertexAttribDivisor.sig = "vii";
        var _emscripten_glVertexAttribDivisorANGLE = _glVertexAttribDivisor;
        var _emscripten_glVertexAttribDivisorARB = _glVertexAttribDivisor;
        var _emscripten_glVertexAttribDivisorEXT = _glVertexAttribDivisor;
        var _emscripten_glVertexAttribDivisorNV = _glVertexAttribDivisor;
        var _emscripten_glVertexAttribI4i = (e, r, t, n, a) => GLctx.vertexAttribI4i(e, r, t, n, a);
        _emscripten_glVertexAttribI4i.sig = "viiiii";
        var _emscripten_glVertexAttribI4iv = (e, r) => {
          GLctx.vertexAttribI4i(e, HEAP32[r >> 2], HEAP32[r + 4 >> 2], HEAP32[r + 8 >> 2], HEAP32[r + 12 >> 2]);
        };
        _emscripten_glVertexAttribI4iv.sig = "vip";
        var _emscripten_glVertexAttribI4ui = (e, r, t, n, a) => GLctx.vertexAttribI4ui(e, r, t, n, a);
        _emscripten_glVertexAttribI4ui.sig = "viiiii";
        var _emscripten_glVertexAttribI4uiv = (e, r) => {
          GLctx.vertexAttribI4ui(e, HEAPU32[r >> 2], HEAPU32[r + 4 >> 2], HEAPU32[r + 8 >> 2], HEAPU32[r + 12 >> 2]);
        };
        _emscripten_glVertexAttribI4uiv.sig = "vip";
        var _emscripten_glVertexAttribIPointer = (e, r, t, n, a) => {
          GLctx.vertexAttribIPointer(e, r, t, n, a);
        };
        _emscripten_glVertexAttribIPointer.sig = "viiiip";
        var _emscripten_glVertexAttribPointer = (e, r, t, n, a, o) => {
          var l = GL.currentContext.clientBuffers[e];
          if (!GLctx.currentArrayBufferBinding) {
            l.size = r;
            l.type = t;
            l.normalized = n;
            l.stride = a;
            l.ptr = o;
            l.clientside = true;
            l.vertexAttribPointerAdaptor = function (c, _, u, m, f, v) {
              this.vertexAttribPointer(c, _, u, m, f, v);
            };
            return;
          }
          l.clientside = false;
          GLctx.vertexAttribPointer(e, r, t, !!n, a, o);
        };
        _emscripten_glVertexAttribPointer.sig = "viiiiip";
        var _emscripten_glViewport = (e, r, t, n) => GLctx.viewport(e, r, t, n);
        _emscripten_glViewport.sig = "viiii";
        var _emscripten_glWaitSync = (e, r, t) => {
          t = Number(t);
          GLctx.waitSync(GL.syncs[e], r, t);
        };
        _emscripten_glWaitSync.sig = "vpij";
        var _emscripten_has_asyncify = () => 0;
        _emscripten_has_asyncify.sig = "i";
        var _emscripten_net_bind = (e, r, t) => Module.net?.bind?.(e, r, t) ?? -1;
        var _emscripten_net_closesocket = e => Module.net?.closesocket?.(e) ?? -1;
        var _emscripten_net_getaddrinfo = (e, r, t, n) => Module.net?.getaddrinfo?.(e, r, t, n) ?? -1;
        var _emscripten_net_gethostname = (e, r) => Module.net?.gethostname?.(e, r) ?? -1;
        var _emscripten_net_getsockname = (e, r, t) => Module.net?.getsockname?.(e, r, t) ?? -1;
        var _emscripten_net_recvfrom = (e, r, t, n, a, o) => Module.net?.recvfrom?.(e, r, t, n, a, o) ?? -1;
        var _emscripten_net_sendto = (e, r, t, n, a, o) => Module.net?.sendto?.(e, r, t, n, a, o) ?? -1;
        var _emscripten_net_sendto_batch = (e, r, t, n, a, o) => Module.net?.sendto_batch?.(e, r, t, n, a, o) ?? -1;
        var _emscripten_net_socket = (e, r, t) => Module.net?.socket?.(e, r, t) ?? -1;
        var _emscripten_out = e => out(UTF8ToString(e));
        _emscripten_out.sig = "vp";
        class HandleAllocator {
          constructor() {
            this.allocated = [undefined];
            this.freelist = [];
          }
          get(r) {
            return this.allocated[r];
          }
          has(r) {
            return this.allocated[r] !== undefined;
          }
          allocate(r) {
            var t = this.freelist.pop() || this.allocated.length;
            this.allocated[t] = r;
            return t;
          }
          free(r) {
            this.allocated[r] = undefined;
            this.freelist.push(r);
          }
        }
        var promiseMap = new HandleAllocator();
        var makePromise = () => {
          var e = {};
          e.promise = new Promise((r, t) => {
            e.reject = t;
            e.resolve = r;
          });
          e.id = promiseMap.allocate(e);
          return e;
        };
        var _emscripten_promise_create = () => makePromise().id;
        _emscripten_promise_create.sig = "p";
        var _emscripten_promise_destroy = e => {
          promiseMap.free(e);
        };
        _emscripten_promise_destroy.sig = "vp";
        var getPromise = e => promiseMap.get(e).promise;
        var _emscripten_promise_resolve = (e, r, t) => {
          var n = promiseMap.get(e);
          switch (r) {
            case 0:
              n.resolve(t);
              return;
            case 1:
              n.resolve(getPromise(t));
              return;
            case 2:
              n.resolve(getPromise(t));
              _emscripten_promise_destroy(t);
              return;
            case 3:
              n.reject(t);
              return;
          }
        };
        _emscripten_promise_resolve.sig = "vpip";
        var doRequestFullscreen = (e, r) => JSEvents.fullscreenEnabled() ? (e = findEventTarget(e), e ? !e.requestFullscreen && !e.webkitRequestFullscreen ? -3 : JSEvents.canPerformEventHandlerRequests() ? JSEvents_requestFullscreen(e, r) : r.deferUntilInEventHandler ? (JSEvents.deferCall(JSEvents_requestFullscreen, 1, [e, r]), 1) : -2 : -4) : -1;
        var _emscripten_request_fullscreen_strategy = (e, r, t) => {
          var n = {
            scaleMode: HEAP32[t >> 2],
            canvasResolutionScaleMode: HEAP32[t + 4 >> 2],
            filteringMode: HEAP32[t + 8 >> 2],
            deferUntilInEventHandler: r,
            canvasResizedCallback: HEAP32[t + 12 >> 2],
            canvasResizedCallbackUserData: HEAP32[t + 16 >> 2]
          };
          return doRequestFullscreen(e, n);
        };
        _emscripten_request_fullscreen_strategy.sig = "ipip";
        var _emscripten_request_pointerlock = (e, r) => {
          e = findEventTarget(e);
          if (e) {
            if (e.requestPointerLock) {
              if (JSEvents.canPerformEventHandlerRequests()) {
                return requestPointerLock(e);
              } else if (r) {
                JSEvents.deferCall(requestPointerLock, 2, [e]);
                return 1;
              } else {
                return -2;
              }
            } else {
              return -1;
            }
          } else {
            return -4;
          }
        };
        _emscripten_request_pointerlock.sig = "ipi";
        var abortOnCannotGrowMemory = e => {
          abort("OOM");
        };
        var _emscripten_resize_heap = e => {
          var r = HEAPU8.length;
          e >>>= 0;
          abortOnCannotGrowMemory(e);
        };
        _emscripten_resize_heap.sig = "ip";
        var _emscripten_sample_gamepad_data = () => {
          try {
            if (navigator.getGamepads) {
              if (JSEvents.lastGamepadState = navigator.getGamepads()) {
                return 0;
              } else {
                return -1;
              }
            }
          } catch {
            navigator.getGamepads = null;
          }
          return -1;
        };
        _emscripten_sample_gamepad_data.sig = "i";
        var registerBeforeUnloadEventCallback = (e, r, t, n, a, o) => {
          var l = _ => {
            var u = getWasmTableEntry(n)(a, 0, r);
            u &&= UTF8ToString(u);
            if (u) {
              _.preventDefault();
              _.returnValue = u;
              return u;
            }
          };
          var c = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: l,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(c);
        };
        var _emscripten_set_beforeunload_callback_on_thread = (e, r, t) => typeof onbeforeunload === "undefined" ? -1 : t !== 1 ? -5 : registerBeforeUnloadEventCallback(2, e, true, r, 28, "beforeunload");
        _emscripten_set_beforeunload_callback_on_thread.sig = "ippp";
        var registerFocusEventCallback = (e, r, t, n, a, o, l) => {
          var c = 256;
          JSEvents.focusEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.getNodeNameForTarget(m.target);
            var v = m.target.id ? m.target.id : "";
            var g = JSEvents.focusEvent;
            stringToUTF8(f, g + 0, 128);
            stringToUTF8(v, g + 128, 128);
            if (getWasmTableEntry(n)(a, g, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_blur_callback_on_thread = (e, r, t, n, a) => registerFocusEventCallback(e, r, t, n, 12, "blur", a);
        _emscripten_set_blur_callback_on_thread.sig = "ippipp";
        var _emscripten_set_element_css_size = (e, r, t) => {
          e = findEventTarget(e);
          if (e) {
            e.style.width = r + "px";
            e.style.height = t + "px";
            return 0;
          } else {
            return -4;
          }
        };
        _emscripten_set_element_css_size.sig = "ipdd";
        var _emscripten_set_focus_callback_on_thread = (e, r, t, n, a) => registerFocusEventCallback(e, r, t, n, 13, "focus", a);
        _emscripten_set_focus_callback_on_thread.sig = "ippipp";
        var fillFullscreenChangeEventData = e => {
          var r = getFullscreenElement();
          var t = !!r;
          HEAP8[e] = t;
          HEAP8[e + 1] = JSEvents.fullscreenEnabled();
          var n = t ? r : JSEvents.previousFullscreenElement;
          var a = JSEvents.getNodeNameForTarget(n);
          var o = n?.id || "";
          stringToUTF8(a, e + 2, 128);
          stringToUTF8(o, e + 130, 128);
          HEAP32[e + 260 >> 2] = n ? n.clientWidth : 0;
          HEAP32[e + 264 >> 2] = n ? n.clientHeight : 0;
          HEAP32[e + 268 >> 2] = screen.width;
          HEAP32[e + 272 >> 2] = screen.height;
          if (t) {
            JSEvents.previousFullscreenElement = r;
          }
        };
        var registerFullscreenChangeEventCallback = (e, r, t, n, a, o, l) => {
          var c = 276;
          JSEvents.fullscreenChangeEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.fullscreenChangeEvent;
            fillFullscreenChangeEventData(f);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_fullscreenchange_callback_on_thread = (e, r, t, n, a) => JSEvents.fullscreenEnabled() ? (e = findEventTarget(e), e ? (registerFullscreenChangeEventCallback(e, r, t, n, 19, "webkitfullscreenchange", a), registerFullscreenChangeEventCallback(e, r, t, n, 19, "fullscreenchange", a)) : -4) : -1;
        _emscripten_set_fullscreenchange_callback_on_thread.sig = "ippipp";
        var registerGamepadEventCallback = (e, r, t, n, a, o, l) => {
          var c = 1240;
          JSEvents.gamepadEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.gamepadEvent;
            fillGamepadEventData(f, m.gamepad);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: findEventTarget(e),
            allowsDeferredCalls: true,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_gamepadconnected_callback_on_thread = (e, r, t, n) => _emscripten_sample_gamepad_data() ? -1 : registerGamepadEventCallback(2, e, r, t, 26, "gamepadconnected", n);
        _emscripten_set_gamepadconnected_callback_on_thread.sig = "ipipp";
        var _emscripten_set_gamepaddisconnected_callback_on_thread = (e, r, t, n) => _emscripten_sample_gamepad_data() ? -1 : registerGamepadEventCallback(2, e, r, t, 27, "gamepaddisconnected", n);
        _emscripten_set_gamepaddisconnected_callback_on_thread.sig = "ipipp";
        var registerKeyEventCallback = (e, r, t, n, a, o, l) => {
          var c = 160;
          JSEvents.keyEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.keyEvent;
            HEAPF64[f >> 3] = m.timeStamp;
            var v = f >> 2;
            HEAP32[v + 2] = m.location;
            HEAP8[f + 12] = m.ctrlKey;
            HEAP8[f + 13] = m.shiftKey;
            HEAP8[f + 14] = m.altKey;
            HEAP8[f + 15] = m.metaKey;
            HEAP8[f + 16] = m.repeat;
            HEAP32[v + 5] = m.charCode;
            HEAP32[v + 6] = m.keyCode;
            HEAP32[v + 7] = m.which;
            stringToUTF8(m.key || "", f + 32, 32);
            stringToUTF8(m.code || "", f + 64, 32);
            stringToUTF8(m.char || "", f + 96, 32);
            stringToUTF8(m.locale || "", f + 128, 32);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_keydown_callback_on_thread = (e, r, t, n, a) => registerKeyEventCallback(e, r, t, n, 2, "keydown", a);
        _emscripten_set_keydown_callback_on_thread.sig = "ippipp";
        var _emscripten_set_keypress_callback_on_thread = (e, r, t, n, a) => registerKeyEventCallback(e, r, t, n, 1, "keypress", a);
        _emscripten_set_keypress_callback_on_thread.sig = "ippipp";
        var _emscripten_set_keyup_callback_on_thread = (e, r, t, n, a) => registerKeyEventCallback(e, r, t, n, 3, "keyup", a);
        _emscripten_set_keyup_callback_on_thread.sig = "ippipp";
        var _emscripten_set_main_loop_arg = (e, r, t, n) => {
          var a = () => getWasmTableEntry(e)(r);
          setMainLoop(a, t, n, r);
        };
        _emscripten_set_main_loop_arg.sig = "vppii";
        var fillMouseEventData = (e, r, t) => {
          HEAPF64[e >> 3] = r.timeStamp;
          var n = e >> 2;
          HEAP32[n + 2] = r.screenX;
          HEAP32[n + 3] = r.screenY;
          HEAP32[n + 4] = r.clientX;
          HEAP32[n + 5] = r.clientY;
          HEAP8[e + 24] = r.ctrlKey;
          HEAP8[e + 25] = r.shiftKey;
          HEAP8[e + 26] = r.altKey;
          HEAP8[e + 27] = r.metaKey;
          HEAP16[n * 2 + 14] = r.button;
          HEAP16[n * 2 + 15] = r.buttons;
          HEAP32[n + 8] = r.movementX;
          HEAP32[n + 9] = r.movementY;
          var a = getBoundingClientRect(t);
          HEAP32[n + 10] = r.clientX - (a.left | 0);
          HEAP32[n + 11] = r.clientY - (a.top | 0);
        };
        var registerMouseEventCallback = (e, r, t, n, a, o, l) => {
          var c = 64;
          JSEvents.mouseEvent ||= _malloc(c);
          e = findEventTarget(e);
          var _ = m => {
            fillMouseEventData(JSEvents.mouseEvent, m, e);
            if (getWasmTableEntry(n)(a, JSEvents.mouseEvent, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            allowsDeferredCalls: o != "mousemove" && o != "mouseenter" && o != "mouseleave",
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_mousedown_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 5, "mousedown", a);
        _emscripten_set_mousedown_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mouseenter_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 33, "mouseenter", a);
        _emscripten_set_mouseenter_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mouseleave_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 34, "mouseleave", a);
        _emscripten_set_mouseleave_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mousemove_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 8, "mousemove", a);
        _emscripten_set_mousemove_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mouseup_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 6, "mouseup", a);
        _emscripten_set_mouseup_callback_on_thread.sig = "ippipp";
        var fillPointerlockChangeEventData = e => {
          var r = document.pointerLockElement;
          var t = !!r;
          HEAP8[e] = t;
          var n = JSEvents.getNodeNameForTarget(r);
          var a = r?.id || "";
          stringToUTF8(n, e + 1, 128);
          stringToUTF8(a, e + 129, 128);
        };
        var registerPointerlockChangeEventCallback = (e, r, t, n, a, o, l) => {
          var c = 257;
          JSEvents.pointerlockChangeEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.pointerlockChangeEvent;
            fillPointerlockChangeEventData(f);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_pointerlockchange_callback_on_thread = (e, r, t, n, a) => document.body?.requestPointerLock ? (e = findEventTarget(e), e ? registerPointerlockChangeEventCallback(e, r, t, n, 20, "pointerlockchange", a) : -4) : -1;
        _emscripten_set_pointerlockchange_callback_on_thread.sig = "ippipp";
        var registerUiEventCallback = (e, r, t, n, a, o, l) => {
          var c = 36;
          JSEvents.uiEvent ||= _malloc(c);
          e = findEventTarget(e);
          var _ = m => {
            if (m.target == e) {
              var f = document.body;
              if (f) {
                var v = JSEvents.uiEvent;
                HEAP32[v >> 2] = 0;
                HEAP32[v + 4 >> 2] = f.clientWidth;
                HEAP32[v + 8 >> 2] = f.clientHeight;
                HEAP32[v + 12 >> 2] = innerWidth;
                HEAP32[v + 16 >> 2] = innerHeight;
                HEAP32[v + 20 >> 2] = outerWidth;
                HEAP32[v + 24 >> 2] = outerHeight;
                HEAP32[v + 28 >> 2] = pageXOffset | 0;
                HEAP32[v + 32 >> 2] = pageYOffset | 0;
                if (getWasmTableEntry(n)(a, v, r)) {
                  m.preventDefault();
                }
              }
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_resize_callback_on_thread = (e, r, t, n, a) => registerUiEventCallback(e, r, t, n, 10, "resize", a);
        _emscripten_set_resize_callback_on_thread.sig = "ippipp";
        var _emscripten_set_timeout = (e, r, t) => safeSetTimeout(() => getWasmTableEntry(e)(t), r);
        _emscripten_set_timeout.sig = "ipdp";
        var registerTouchEventCallback = (e, r, t, n, a, o, l) => {
          var c = 1552;
          JSEvents.touchEvent ||= _malloc(c);
          e = findEventTarget(e);
          var _ = m => {
            var f;
            var v = {};
            var g = m.touches;
            for (let A of g) {
              A.isChanged = A.onTarget = 0;
              v[A.identifier] = A;
            }
            for (let A of m.changedTouches) {
              A.isChanged = 1;
              v[A.identifier] = A;
            }
            for (let A of m.targetTouches) {
              v[A.identifier].onTarget = 1;
            }
            var h = JSEvents.touchEvent;
            HEAPF64[h >> 3] = m.timeStamp;
            HEAP8[h + 12] = m.ctrlKey;
            HEAP8[h + 13] = m.shiftKey;
            HEAP8[h + 14] = m.altKey;
            HEAP8[h + 15] = m.metaKey;
            var p = h + 16;
            var b = getBoundingClientRect(e);
            var S = 0;
            for (let A of Object.values(v)) {
              var w = p >> 2;
              HEAP32[w + 0] = A.identifier;
              HEAP32[w + 1] = A.screenX;
              HEAP32[w + 2] = A.screenY;
              HEAP32[w + 3] = A.clientX;
              HEAP32[w + 4] = A.clientY;
              HEAP32[w + 5] = A.pageX;
              HEAP32[w + 6] = A.pageY;
              HEAP8[p + 28] = A.isChanged;
              HEAP8[p + 29] = A.onTarget;
              HEAP32[w + 8] = A.clientX - (b.left | 0);
              HEAP32[w + 9] = A.clientY - (b.top | 0);
              p += 48;
              if (++S > 31) {
                break;
              }
            }
            HEAP32[h + 8 >> 2] = S;
            if (getWasmTableEntry(n)(a, h, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            allowsDeferredCalls: o == "touchstart" || o == "touchend",
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_touchcancel_callback_on_thread = (e, r, t, n, a) => registerTouchEventCallback(e, r, t, n, 25, "touchcancel", a);
        _emscripten_set_touchcancel_callback_on_thread.sig = "ippipp";
        var _emscripten_set_touchend_callback_on_thread = (e, r, t, n, a) => registerTouchEventCallback(e, r, t, n, 23, "touchend", a);
        _emscripten_set_touchend_callback_on_thread.sig = "ippipp";
        var _emscripten_set_touchmove_callback_on_thread = (e, r, t, n, a) => registerTouchEventCallback(e, r, t, n, 24, "touchmove", a);
        _emscripten_set_touchmove_callback_on_thread.sig = "ippipp";
        var _emscripten_set_touchstart_callback_on_thread = (e, r, t, n, a) => registerTouchEventCallback(e, r, t, n, 22, "touchstart", a);
        _emscripten_set_touchstart_callback_on_thread.sig = "ippipp";
        var fillVisibilityChangeEventData = e => {
          var r = ["hidden", "visible", "prerender", "unloaded"];
          var t = r.indexOf(document.visibilityState);
          HEAP8[e] = document.hidden;
          HEAP32[e + 4 >> 2] = t;
        };
        var registerVisibilityChangeEventCallback = (e, r, t, n, a, o, l) => {
          var c = 8;
          JSEvents.visibilityChangeEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.visibilityChangeEvent;
            fillVisibilityChangeEventData(f);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_visibilitychange_callback_on_thread = (e, r, t, n) => registerVisibilityChangeEventCallback(specialHTMLTargets[1], e, r, t, 21, "visibilitychange", n);
        _emscripten_set_visibilitychange_callback_on_thread.sig = "ipipp";
        var registerWheelEventCallback = (e, r, t, n, a, o, l) => {
          var c = 96;
          JSEvents.wheelEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.wheelEvent;
            fillMouseEventData(f, m, e);
            HEAPF64[f + 64 >> 3] = m.deltaX;
            HEAPF64[f + 72 >> 3] = m.deltaY;
            HEAPF64[f + 80 >> 3] = m.deltaZ;
            HEAP32[f + 88 >> 2] = m.deltaMode;
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            allowsDeferredCalls: true,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_wheel_callback_on_thread = (e, r, t, n, a) => {
          e = findEventTarget(e);
          if (e) {
            if (typeof e.onwheel !== "undefined") {
              return registerWheelEventCallback(e, r, t, n, 9, "wheel", a);
            } else {
              return -1;
            }
          } else {
            return -4;
          }
        };
        _emscripten_set_wheel_callback_on_thread.sig = "ippipp";
        var _emscripten_set_window_title = e => document.title = UTF8ToString(e);
        _emscripten_set_window_title.sig = "vp";
        var _emscripten_sleep = () => {
          abort("Please compile your program with async support in order to use asynchronous operations like emscripten_sleep");
        };
        _emscripten_sleep.sig = "vi";
        var _emscripten_wget_data = (e, r, t, n) => {
          abort("Please compile your program with async support in order to use asynchronous operations like emscripten_wget_data");
        };
        _emscripten_wget_data.sig = "vpppp";
        var ENV = {};
        var getEnvStrings = () => {
          if (!getEnvStrings.strings) {
            var e = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8";
            var r = {
              USER: "web_user",
              LOGNAME: "web_user",
              PATH: "/",
              PWD: "/",
              HOME: "/home/web_user",
              LANG: e,
              _: getExecutableName()
            };
            for (var t in ENV) {
              if (ENV[t] === undefined) {
                delete r[t];
              } else {
                r[t] = ENV[t];
              }
            }
            var n = [];
            for (var t in r) {
              n.push(`${t}=${r[t]}`);
            }
            getEnvStrings.strings = n;
          }
          return getEnvStrings.strings;
        };
        var _environ_get = (e, r) => {
          var t = 0;
          var n = 0;
          for (var a of getEnvStrings()) {
            var o = r + t;
            HEAPU32[e + n >> 2] = o;
            t += stringToUTF8(a, o, Infinity) + 1;
            n += 4;
          }
          return 0;
        };
        _environ_get.sig = "ipp";
        var _environ_sizes_get = (e, r) => {
          var t = getEnvStrings();
          HEAPU32[e >> 2] = t.length;
          var n = 0;
          for (var a of t) {
            n += lengthBytesUTF8(a) + 1;
          }
          HEAPU32[r >> 2] = n;
          return 0;
        };
        _environ_sizes_get.sig = "ipp";
        function _fd_close(e) {
          try {
            var r = SYSCALLS.getStreamFromFD(e);
            FS.close(r);
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return t.errno;
          }
        }
        _fd_close.sig = "ii";
        function _fd_fdstat_get(e, r) {
          try {
            var t = 0;
            var n = 0;
            var a = 0;
            var o = SYSCALLS.getStreamFromFD(e);
            var l = o.tty ? 2 : FS.isDir(o.mode) ? 3 : FS.isLink(o.mode) ? 7 : 4;
            HEAP8[r] = l;
            HEAP16[r + 2 >> 1] = a;
            HEAP64[r + 8 >> 3] = BigInt(t);
            HEAP64[r + 16 >> 3] = BigInt(n);
            return 0;
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return c.errno;
          }
        }
        _fd_fdstat_get.sig = "iip";
        var doReadv = (e, r, t, n) => {
          var a = 0;
          for (var o = 0; o < t; o++) {
            var l = HEAPU32[r >> 2];
            var c = HEAPU32[r + 4 >> 2];
            r += 8;
            var _ = FS.read(e, HEAP8, l, c, n);
            if (_ < 0) {
              return -1;
            }
            a += _;
            if (_ < c) {
              break;
            }
            if (typeof n !== "undefined") {
              n += _;
            }
          }
          return a;
        };
        function _fd_pread(e, r, t, n, a) {
          n = bigintToI53Checked(n);
          try {
            if (isNaN(n)) {
              return 61;
            }
            var o = SYSCALLS.getStreamFromFD(e);
            var l = doReadv(o, r, t, n);
            HEAPU32[a >> 2] = l;
            return 0;
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return c.errno;
          }
        }
        _fd_pread.sig = "iippjp";
        var doWritev = (e, r, t, n) => {
          var a = 0;
          for (var o = 0; o < t; o++) {
            var l = HEAPU32[r >> 2];
            var c = HEAPU32[r + 4 >> 2];
            r += 8;
            var _ = FS.write(e, HEAP8, l, c, n);
            if (_ < 0) {
              return -1;
            }
            a += _;
            if (_ < c) {
              break;
            }
            if (typeof n !== "undefined") {
              n += _;
            }
          }
          return a;
        };
        function _fd_pwrite(e, r, t, n, a) {
          n = bigintToI53Checked(n);
          try {
            if (isNaN(n)) {
              return 61;
            }
            var o = SYSCALLS.getStreamFromFD(e);
            var l = doWritev(o, r, t, n);
            HEAPU32[a >> 2] = l;
            return 0;
          } catch (c) {
            if (typeof FS === "undefined" || c.name !== "ErrnoError") {
              throw c;
            }
            return c.errno;
          }
        }
        _fd_pwrite.sig = "iippjp";
        function _fd_read(e, r, t, n) {
          try {
            var a = SYSCALLS.getStreamFromFD(e);
            var o = doReadv(a, r, t);
            HEAPU32[n >> 2] = o;
            return 0;
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return l.errno;
          }
        }
        _fd_read.sig = "iippp";
        function _fd_seek(e, r, t, n) {
          r = bigintToI53Checked(r);
          try {
            if (isNaN(r)) {
              return 61;
            }
            var a = SYSCALLS.getStreamFromFD(e);
            FS.llseek(a, r, t);
            HEAP64[n >> 3] = BigInt(a.position);
            if (a.getdents && r === 0 && t === 0) {
              a.getdents = null;
            }
            return 0;
          } catch (o) {
            if (typeof FS === "undefined" || o.name !== "ErrnoError") {
              throw o;
            }
            return o.errno;
          }
        }
        _fd_seek.sig = "iijip";
        function _fd_sync(e) {
          try {
            var r = SYSCALLS.getStreamFromFD(e);
            var t = r.stream_ops?.fsync?.(r);
            return t;
          } catch (n) {
            if (typeof FS === "undefined" || n.name !== "ErrnoError") {
              throw n;
            }
            return n.errno;
          }
        }
        _fd_sync.sig = "ii";
        function _fd_write(e, r, t, n) {
          try {
            var a = SYSCALLS.getStreamFromFD(e);
            var o = doWritev(a, r, t);
            HEAPU32[n >> 2] = o;
            return 0;
          } catch (l) {
            if (typeof FS === "undefined" || l.name !== "ErrnoError") {
              throw l;
            }
            return l.errno;
          }
        }
        _fd_write.sig = "iippp";
        var _getnameinfo = (e, r, t, n, a, o, l) => {
          var c = readSockaddr(e, r);
          if (c.errno) {
            return -6;
          }
          var _ = c.port;
          var u = c.addr;
          var m = false;
          if (t && n) {
            var f;
            if (l & 1 || !(f = DNS.lookup_addr(u))) {
              if (l & 8) {
                return -2;
              }
            } else {
              u = f;
            }
            var v = stringToUTF8(u, t, n);
            if (v + 1 >= n) {
              m = true;
            }
          }
          if (a && o) {
            _ = "" + _;
            var v = stringToUTF8(_, a, o);
            if (v + 1 >= o) {
              m = true;
            }
          }
          if (m) {
            return -12;
          } else {
            return 0;
          }
        };
        _getnameinfo.sig = "ipipipii";
        function _random_get(e, r) {
          try {
            randomFill(HEAPU8.subarray(e, e + r));
            return 0;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return t.errno;
          }
        }
        _random_get.sig = "ipp";
        var getCFunc = e => {
          var r = Module["_" + e];
          return r;
        };
        var writeArrayToMemory = (e, r) => {
          HEAP8.set(e, r);
        };
        var ccall = (e, r, t, n, a) => {
          var o = {
            string: h => {
              var p = 0;
              if (h != null && h !== 0) {
                p = stringToUTF8OnStack(h);
              }
              return p;
            },
            array: h => {
              var p = stackAlloc(h.length);
              writeArrayToMemory(h, p);
              return p;
            }
          };
          function l(h) {
            if (r === "string") {
              return UTF8ToString(h);
            } else if (r === "boolean") {
              return !!h;
            } else {
              return h;
            }
          }
          var c = getCFunc(e);
          var _ = [];
          var u = 0;
          if (n) {
            for (var m = 0; m < n.length; m++) {
              var f = o[t[m]];
              if (f) {
                if (u === 0) {
                  u = stackSave();
                }
                _[m] = f(n[m]);
              } else {
                _[m] = n[m];
              }
            }
          }
          var v = c(..._);
          function g(h) {
            if (u !== 0) {
              stackRestore(u);
            }
            return l(h);
          }
          v = g(v);
          return v;
        };
        var createContext = Browser.createContext;
        var writeI53ToI64Clamped = (e, r) => {
          if (r > 9223372036854776000) {
            HEAPU32[e >> 2] = 4294967295;
            HEAPU32[e + 4 >> 2] = 2147483647;
          } else if (r < -9223372036854776000) {
            HEAPU32[e >> 2] = 0;
            HEAPU32[e + 4 >> 2] = 2147483648;
          } else {
            writeI53ToI64(e, r);
          }
        };
        var writeI53ToI64Signaling = (e, r) => {
          if (r > 9223372036854776000 || r < -9223372036854776000) {
            throw `RangeError: ${r}`;
          }
          writeI53ToI64(e, r);
        };
        var writeI53ToU64Clamped = (e, r) => {
          if (r > 18446744073709552000) {
            HEAPU32[e >> 2] = 4294967295;
            HEAPU32[e + 4 >> 2] = 4294967295;
          } else if (r < 0) {
            HEAPU32[e >> 2] = 0;
            HEAPU32[e + 4 >> 2] = 0;
          } else {
            writeI53ToI64(e, r);
          }
        };
        var writeI53ToU64Signaling = (e, r) => {
          if (r < 0 || r > 18446744073709552000) {
            throw `RangeError: ${r}`;
          }
          writeI53ToI64(e, r);
        };
        var readI53FromU64 = e => HEAPU32[e >> 2] + HEAPU32[e + 4 >> 2] * 4294967296;
        var convertI32PairToI53 = (e, r) => (e >>> 0) + r * 4294967296;
        var convertI32PairToI53Checked = (e, r) => r + 2097152 >>> 0 < 4194305 - !!e ? (e >>> 0) + r * 4294967296 : NaN;
        var convertU32PairToI53 = (e, r) => (e >>> 0) + (r >>> 0) * 4294967296;
        var getTempRet0 = e => __emscripten_tempret_get();
        var setTempRet0 = e => __emscripten_tempret_set(e);
        var _stackAlloc = stackAlloc;
        var _stackSave = stackSave;
        var _stackRestore = stackSave;
        var _setTempRet0 = setTempRet0;
        var _getTempRet0 = getTempRet0;
        var ptrToString = e => {
          e >>>= 0;
          return "0x" + e.toString(16).padStart(8, "0");
        };
        var growMemory = e => {
          var r = wasmMemory.buffer.byteLength;
          var t = (e - r + 65535) / 65536 | 0;
          try {
            wasmMemory.grow(t);
            updateMemoryViews();
            return 1;
          } catch {}
        };
        var _emscripten_notify_memory_growth = e => {
          updateMemoryViews();
        };
        _emscripten_notify_memory_growth.sig = "vp";
        var ERRNO_CODES = {
          EPERM: 63,
          ENOENT: 44,
          ESRCH: 71,
          EINTR: 27,
          EIO: 29,
          ENXIO: 60,
          E2BIG: 1,
          ENOEXEC: 45,
          EBADF: 8,
          ECHILD: 12,
          EAGAIN: 6,
          EWOULDBLOCK: 6,
          ENOMEM: 48,
          EACCES: 2,
          EFAULT: 21,
          ENOTBLK: 105,
          EBUSY: 10,
          EEXIST: 20,
          EXDEV: 75,
          ENODEV: 43,
          ENOTDIR: 54,
          EISDIR: 31,
          EINVAL: 28,
          ENFILE: 41,
          EMFILE: 33,
          ENOTTY: 59,
          ETXTBSY: 74,
          EFBIG: 22,
          ENOSPC: 51,
          ESPIPE: 70,
          EROFS: 69,
          EMLINK: 34,
          EPIPE: 64,
          EDOM: 18,
          ERANGE: 68,
          ENOMSG: 49,
          EIDRM: 24,
          ECHRNG: 106,
          EL2NSYNC: 156,
          EL3HLT: 107,
          EL3RST: 108,
          ELNRNG: 109,
          EUNATCH: 110,
          ENOCSI: 111,
          EL2HLT: 112,
          EDEADLK: 16,
          ENOLCK: 46,
          EBADE: 113,
          EBADR: 114,
          EXFULL: 115,
          ENOANO: 104,
          EBADRQC: 103,
          EBADSLT: 102,
          EDEADLOCK: 16,
          EBFONT: 101,
          ENOSTR: 100,
          ENODATA: 116,
          ETIME: 117,
          ENOSR: 118,
          ENONET: 119,
          ENOPKG: 120,
          EREMOTE: 121,
          ENOLINK: 47,
          EADV: 122,
          ESRMNT: 123,
          ECOMM: 124,
          EPROTO: 65,
          EMULTIHOP: 36,
          EDOTDOT: 125,
          EBADMSG: 9,
          ENOTUNIQ: 126,
          EBADFD: 127,
          EREMCHG: 128,
          ELIBACC: 129,
          ELIBBAD: 130,
          ELIBSCN: 131,
          ELIBMAX: 132,
          ELIBEXEC: 133,
          ENOSYS: 52,
          ENOTEMPTY: 55,
          ENAMETOOLONG: 37,
          ELOOP: 32,
          EOPNOTSUPP: 138,
          EPFNOSUPPORT: 139,
          ECONNRESET: 15,
          ENOBUFS: 42,
          EAFNOSUPPORT: 5,
          EPROTOTYPE: 67,
          ENOTSOCK: 57,
          ENOPROTOOPT: 50,
          ESHUTDOWN: 140,
          ECONNREFUSED: 14,
          EADDRINUSE: 3,
          ECONNABORTED: 13,
          ENETUNREACH: 40,
          ENETDOWN: 38,
          ETIMEDOUT: 73,
          EHOSTDOWN: 142,
          EHOSTUNREACH: 23,
          EINPROGRESS: 26,
          EALREADY: 7,
          EDESTADDRREQ: 17,
          EMSGSIZE: 35,
          EPROTONOSUPPORT: 66,
          ESOCKTNOSUPPORT: 137,
          EADDRNOTAVAIL: 4,
          ENETRESET: 39,
          EISCONN: 30,
          ENOTCONN: 53,
          ETOOMANYREFS: 141,
          EUSERS: 136,
          EDQUOT: 19,
          ESTALE: 72,
          ENOTSUP: 138,
          ENOMEDIUM: 148,
          EILSEQ: 25,
          EOVERFLOW: 61,
          ECANCELED: 11,
          ENOTRECOVERABLE: 56,
          EOWNERDEAD: 62,
          ESTRPIPE: 135
        };
        var strError = e => UTF8ToString(_strerror(e));
        var _getaddrinfo = (e, r, t, n) => {
          var a = [];
          var o = null;
          var l = 0;
          var c = 0;
          var _ = 0;
          var u = 0;
          var m = 0;
          var f = 0;
          var v;
          var g;
          function h(p, b, S, w, A, k) {
            var G;
            var D;
            var F;
            var H;
            D = p === 10 ? 28 : 16;
            A = p === 10 ? inetNtop6(A) : inetNtop4(A);
            G = _malloc(D);
            H = writeSockaddr(G, p, A, k);
            F = _malloc(32);
            HEAP32[F + 4 >> 2] = p;
            HEAP32[F + 8 >> 2] = b;
            HEAP32[F + 12 >> 2] = S;
            HEAPU32[F + 24 >> 2] = w;
            HEAPU32[F + 20 >> 2] = G;
            if (p === 10) {
              HEAP32[F + 16 >> 2] = 28;
            } else {
              HEAP32[F + 16 >> 2] = 16;
            }
            HEAP32[F + 28 >> 2] = 0;
            return F;
          }
          if (t) {
            _ = HEAP32[t >> 2];
            u = HEAP32[t + 4 >> 2];
            m = HEAP32[t + 8 >> 2];
            f = HEAP32[t + 12 >> 2];
          }
          if (m && !f) {
            f = m === 2 ? 17 : 6;
          }
          if (!m && f) {
            m = f === 17 ? 2 : 1;
          }
          if (f === 0) {
            f = 6;
          }
          if (m === 0) {
            m = 1;
          }
          if (!e && !r) {
            return -2;
          }
          if (_ & -1088 || t !== 0 && HEAP32[t >> 2] & 2 && !e) {
            return -1;
          }
          if (_ & 32) {
            return -2;
          }
          if (m !== 0 && m !== 1 && m !== 2) {
            return -7;
          }
          if (u !== 0 && u !== 2 && u !== 10) {
            return -6;
          }
          if (r && (r = UTF8ToString(r), c = parseInt(r, 10), isNaN(c))) {
            if (_ & 1024) {
              return -2;
            } else {
              return -8;
            }
          }
          if (!e) {
            if (u === 0) {
              u = 2;
            }
            if ((_ & 1) === 0) {
              if (u === 2) {
                l = _htonl(2130706433);
              } else {
                l = [0, 0, 0, _htonl(1)];
              }
            }
            v = h(u, m, f, null, l, c);
            HEAPU32[n >> 2] = v;
            return 0;
          }
          e = UTF8ToString(e);
          l = inetPton4(e);
          if (l !== null) {
            if (u === 0 || u === 2) {
              u = 2;
            } else if (u === 10 && _ & 8) {
              l = [0, 0, _htonl(65535), l];
              u = 10;
            } else {
              return -2;
            }
          } else {
            l = inetPton6(e);
            if (l !== null) {
              if (u === 0 || u === 10) {
                u = 10;
              } else {
                return -2;
              }
            }
          }
          if (l != null) {
            v = h(u, m, f, e, l, c);
            HEAPU32[n >> 2] = v;
            return 0;
          } else if (_ & 4) {
            return -2;
          } else {
            e = DNS.lookup_name(e);
            l = inetPton4(e);
            if (u === 0) {
              u = 2;
            } else if (u === 10) {
              l = [0, 0, _htonl(65535), l];
            }
            v = h(u, m, f, null, l, c);
            HEAPU32[n >> 2] = v;
            return 0;
          }
        };
        _getaddrinfo.sig = "ipppp";
        var Protocols = {
          list: [],
          map: {}
        };
        var stringToAscii = (e, r) => {
          for (var t = 0; t < e.length; ++t) {
            HEAP8[r++] = e.charCodeAt(t);
          }
          HEAP8[r] = 0;
        };
        var _setprotoent = e => {
          function r(o, l, c) {
            var _ = _malloc(o.length + 1);
            stringToAscii(o, _);
            for (var u = 0, m = c.length, f = _malloc((m + 1) * 4), v = 0; v < m; v++, u += 4) {
              var g = c[v];
              var h = _malloc(g.length + 1);
              stringToAscii(g, h);
              HEAPU32[f + u >> 2] = h;
            }
            HEAPU32[f + u >> 2] = 0;
            var p = _malloc(12);
            HEAPU32[p >> 2] = _;
            HEAPU32[p + 4 >> 2] = f;
            HEAP32[p + 8 >> 2] = l;
            return p;
          }
          var t = Protocols.list;
          var n = Protocols.map;
          if (t.length === 0) {
            var a = r("tcp", 6, ["TCP"]);
            t.push(a);
            n.tcp = n[6] = a;
            a = r("udp", 17, ["UDP"]);
            t.push(a);
            n.udp = n[17] = a;
          }
          _setprotoent.index = 0;
        };
        _setprotoent.sig = "vi";
        var _endprotoent = () => {};
        _endprotoent.sig = "v";
        var _getprotoent = e => {
          if (_setprotoent.index === Protocols.list.length) {
            return 0;
          }
          var r = Protocols.list[_setprotoent.index++];
          return r;
        };
        _getprotoent.sig = "p";
        var _getprotobyname = e => {
          e = UTF8ToString(e);
          _setprotoent(true);
          var r = Protocols.map[e];
          return r;
        };
        _getprotobyname.sig = "pp";
        var _getprotobynumber = e => {
          _setprotoent(true);
          var r = Protocols.map[e];
          return r;
        };
        _getprotobynumber.sig = "pi";
        var Sockets = {
          BUFFER_SIZE: 10240,
          MAX_BUFFER_SIZE: 10485760,
          nextFd: 1,
          fds: {},
          nextport: 1,
          maxport: 65535,
          peer: null,
          connections: {},
          portmap: {},
          localAddr: 4261412874,
          addrPool: [33554442, 50331658, 67108874, 83886090, 100663306, 117440522, 134217738, 150994954, 167772170, 184549386, 201326602, 218103818, 234881034]
        };
        var _emscripten_run_script = ptr => {
          eval(UTF8ToString(ptr));
        };
        _emscripten_run_script.sig = "vp";
        var _emscripten_run_script_int = ptr => eval(UTF8ToString(ptr)) | 0;
        _emscripten_run_script_int.sig = "ip";
        var _emscripten_run_script_string = ptr => {
          var s = eval(UTF8ToString(ptr));
          if (s == null) {
            return 0;
          }
          s += "";
          var me = _emscripten_run_script_string;
          me.bufferSize = lengthBytesUTF8(s) + 1;
          me.buffer = _realloc(me.buffer ?? 0, me.bufferSize);
          stringToUTF8(s, me.buffer, me.bufferSize);
          return me.buffer;
        };
        _emscripten_run_script_string.sig = "pp";
        var _emscripten_random = () => Math.random();
        _emscripten_random.sig = "f";
        var _emscripten_performance_now = () => performance.now();
        _emscripten_performance_now.sig = "d";
        var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
        __emscripten_get_now_is_monotonic.sig = "i";
        var _emscripten_get_compiler_setting = e => abort("You must build with -sRETAIN_COMPILER_SETTINGS for getCompilerSetting or emscripten_get_compiler_setting to work");
        _emscripten_get_compiler_setting.sig = "pp";
        var _emscripten_debugger = () => {
          debugger;
        };
        _emscripten_debugger.sig = "v";
        var _emscripten_print_double = (e, r, t) => {
          var n = e + "";
          if (r) {
            return stringToUTF8(n, r, t);
          } else {
            return lengthBytesUTF8(n);
          }
        };
        _emscripten_print_double.sig = "idpi";
        var _emscripten_asm_const_double = (e, r, t) => runEmAsmFunction(e, r, t);
        _emscripten_asm_const_double.sig = "dppp";
        var _emscripten_asm_const_double_sync_on_main_thread = (e, r, t) => _emscripten_asm_const_int_sync_on_main_thread(e, r, t);
        _emscripten_asm_const_double_sync_on_main_thread.sig = "dppp";
        var _emscripten_asm_const_async_on_main_thread = (e, r, t) => runMainThreadEmAsm(e, r, t, 0);
        _emscripten_asm_const_async_on_main_thread.sig = "vppp";
        var __Unwind_Backtrace = (e, r) => {
          var t = getCallstack();
          for (var n = t.split(`
`), a = 0; a < n.length; a++) {
            var o = getWasmTableEntry(e)(0, r);
            if (o !== 0) {
              return;
            }
          }
        };
        __Unwind_Backtrace.sig = "ipp";
        var __Unwind_GetIPInfo = (e, r) => abort("Unwind_GetIPInfo");
        __Unwind_GetIPInfo.sig = "ppp";
        var __Unwind_FindEnclosingFunction = e => 0;
        __Unwind_FindEnclosingFunction.sig = "pp";
        class ExceptionInfo {
          constructor(r) {
            this.excPtr = r;
            this.ptr = r - 24;
          }
          set_type(r) {
            HEAPU32[this.ptr + 4 >> 2] = r;
          }
          get_type() {
            return HEAPU32[this.ptr + 4 >> 2];
          }
          set_destructor(r) {
            HEAPU32[this.ptr + 8 >> 2] = r;
          }
          get_destructor() {
            return HEAPU32[this.ptr + 8 >> 2];
          }
          set_caught(r) {
            r = r ? 1 : 0;
            HEAP8[this.ptr + 12] = r;
          }
          get_caught() {
            return HEAP8[this.ptr + 12] != 0;
          }
          set_rethrown(r) {
            r = r ? 1 : 0;
            HEAP8[this.ptr + 13] = r;
          }
          get_rethrown() {
            return HEAP8[this.ptr + 13] != 0;
          }
          init(r, t) {
            this.set_adjusted_ptr(0);
            this.set_type(r);
            this.set_destructor(t);
          }
          set_adjusted_ptr(r) {
            HEAPU32[this.ptr + 16 >> 2] = r;
          }
          get_adjusted_ptr() {
            return HEAPU32[this.ptr + 16 >> 2];
          }
        }
        var exceptionLast = 0;
        var uncaughtExceptionCount = 0;
        var ___cxa_throw = (e, r, t) => {
          var n = new ExceptionInfo(e);
          n.init(r, t);
          exceptionLast = e;
          uncaughtExceptionCount++;
          throw exceptionLast;
        };
        ___cxa_throw.sig = "vppp";
        var __Unwind_RaiseException = e => {
          err("Warning: _Unwind_RaiseException is not correctly implemented");
          return ___cxa_throw(e, 0, 0);
        };
        __Unwind_RaiseException.sig = "ip";
        var __Unwind_DeleteException = e => err("TODO: Unwind_DeleteException");
        __Unwind_DeleteException.sig = "vp";
        var getDynCaller = (e, r, t = false) => (...n) => dynCall(e, r, n, t);
        var _emscripten_exit_with_live_runtime = () => {
          throw "unwind";
        };
        _emscripten_exit_with_live_runtime.sig = "v";
        var _emscripten_outn = (e, r) => out(UTF8ToString(e, r));
        _emscripten_outn.sig = "vpp";
        var _emscripten_errn = (e, r) => err(UTF8ToString(e, r));
        _emscripten_errn.sig = "vpp";
        var _emscripten_throw_number = e => {
          throw e;
        };
        _emscripten_throw_number.sig = "vd";
        var _emscripten_throw_string = e => {
          throw UTF8ToString(e);
        };
        _emscripten_throw_string.sig = "vp";
        var runtimeKeepalivePush = () => {
          runtimeKeepaliveCounter += 1;
        };
        runtimeKeepalivePush.sig = "v";
        var runtimeKeepalivePop = () => {
          runtimeKeepaliveCounter -= 1;
        };
        runtimeKeepalivePop.sig = "v";
        var _emscripten_runtime_keepalive_push = runtimeKeepalivePush;
        _emscripten_runtime_keepalive_push.sig = "v";
        var _emscripten_runtime_keepalive_pop = runtimeKeepalivePop;
        _emscripten_runtime_keepalive_pop.sig = "v";
        var _emscripten_runtime_keepalive_check = keepRuntimeAlive;
        _emscripten_runtime_keepalive_check.sig = "i";
        var asmjsMangle = e => {
          if (e == "__main_argc_argv") {
            e = "main";
          }
          return "_" + e;
        };
        var __emscripten_fs_load_embedded_files = e => {
          do {
            var r = HEAPU32[e >> 2];
            e += 4;
            var t = HEAPU32[e >> 2];
            e += 4;
            var n = HEAPU32[e >> 2];
            e += 4;
            var a = UTF8ToString(r);
            FS.createPath("/", PATH.dirname(a), true, true);
            FS.createDataFile(a, null, HEAP8.subarray(n, n + t), true, true, true);
          } while (HEAPU32[e >> 2]);
        };
        __emscripten_fs_load_embedded_files.sig = "vp";
        var onInits = [];
        var addOnInit = e => onInits.push(e);
        var onMains = [];
        var addOnPreMain = e => onMains.push(e);
        var STACK_SIZE = 16777216;
        var STACK_ALIGN = 16;
        var POINTER_SIZE = 4;
        var ASSERTIONS = 0;
        var cwrap = (e, r, t, n) => {
          var a = !t || t.every(l => l === "number" || l === "boolean");
          var o = r !== "string";
          if (o && a && !n) {
            return getCFunc(e);
          } else {
            return (...l) => ccall(e, r, t, l, n);
          }
        };
        var removeFunction = e => {
          functionsInTableMap.delete(getWasmTableEntry(e));
          setWasmTableEntry(e, null);
          freeTableIndexes.push(e);
        };
        var _emscripten_math_cbrt = Math.cbrt;
        _emscripten_math_cbrt.sig = "dd";
        var _emscripten_math_pow = Math.pow;
        _emscripten_math_pow.sig = "ddd";
        var _emscripten_math_random = Math.random;
        _emscripten_math_random.sig = "d";
        var _emscripten_math_sign = Math.sign;
        _emscripten_math_sign.sig = "dd";
        var _emscripten_math_sqrt = Math.sqrt;
        _emscripten_math_sqrt.sig = "dd";
        var _emscripten_math_exp = Math.exp;
        _emscripten_math_exp.sig = "dd";
        var _emscripten_math_expm1 = Math.expm1;
        _emscripten_math_expm1.sig = "dd";
        var _emscripten_math_fmod = (e, r) => e % r;
        _emscripten_math_fmod.sig = "ddd";
        var _emscripten_math_log = Math.log;
        _emscripten_math_log.sig = "dd";
        var _emscripten_math_log1p = Math.log1p;
        _emscripten_math_log1p.sig = "dd";
        var _emscripten_math_log10 = Math.log10;
        _emscripten_math_log10.sig = "dd";
        var _emscripten_math_log2 = Math.log2;
        _emscripten_math_log2.sig = "dd";
        var _emscripten_math_round = Math.round;
        _emscripten_math_round.sig = "dd";
        var _emscripten_math_acos = Math.acos;
        _emscripten_math_acos.sig = "dd";
        var _emscripten_math_acosh = Math.acosh;
        _emscripten_math_acosh.sig = "dd";
        var _emscripten_math_asin = Math.asin;
        _emscripten_math_asin.sig = "dd";
        var _emscripten_math_asinh = Math.asinh;
        _emscripten_math_asinh.sig = "dd";
        var _emscripten_math_atan = Math.atan;
        _emscripten_math_atan.sig = "dd";
        var _emscripten_math_atanh = Math.atanh;
        _emscripten_math_atanh.sig = "dd";
        var _emscripten_math_atan2 = Math.atan2;
        _emscripten_math_atan2.sig = "ddd";
        var _emscripten_math_cos = Math.cos;
        _emscripten_math_cos.sig = "dd";
        var _emscripten_math_cosh = Math.cosh;
        _emscripten_math_cosh.sig = "dd";
        var _emscripten_math_hypot = (e, r) => {
          var t = [];
          for (var n = 0; n < e; ++n) {
            t.push(HEAPF64[r + n * 8 >> 3]);
          }
          return Math.hypot(...t);
        };
        _emscripten_math_hypot.sig = "dip";
        var _emscripten_math_sin = Math.sin;
        _emscripten_math_sin.sig = "dd";
        var _emscripten_math_sinh = Math.sinh;
        _emscripten_math_sinh.sig = "dd";
        var _emscripten_math_tan = Math.tan;
        _emscripten_math_tan.sig = "dd";
        var _emscripten_math_tanh = Math.tanh;
        _emscripten_math_tanh.sig = "dd";
        var intArrayToString = e => {
          var r = [];
          for (var t = 0; t < e.length; t++) {
            var n = e[t];
            if (n > 255) {
              n &= 255;
            }
            r.push(String.fromCharCode(n));
          }
          return r.join("");
        };
        var AsciiToString = e => {
          var r = "";
          for (;;) {
            var t = HEAPU8[e++];
            if (!t) {
              return r;
            }
            r += String.fromCharCode(t);
          }
        };
        var UTF16Decoder = new TextDecoder("utf-16le");
        var UTF16ToString = (e, r, t) => {
          var n = e >> 1;
          var a = findStringEnd(HEAPU16, n, r / 2, t);
          return UTF16Decoder.decode(HEAPU16.subarray(n, a));
        };
        var stringToUTF16 = (e, r, t) => {
          t ??= 2147483647;
          if (t < 2) {
            return 0;
          }
          t -= 2;
          var n = r;
          for (var a = t < e.length * 2 ? t / 2 : e.length, o = 0; o < a; ++o) {
            var l = e.charCodeAt(o);
            HEAP16[r >> 1] = l;
            r += 2;
          }
          HEAP16[r >> 1] = 0;
          return r - n;
        };
        var lengthBytesUTF16 = e => e.length * 2;
        var UTF32ToString = (e, r, t) => {
          var n = "";
          var a = e >> 2;
          for (var o = 0; !(o >= r / 4); o++) {
            var l = HEAPU32[a + o];
            if (!l && !t) {
              break;
            }
            n += String.fromCodePoint(l);
          }
          return n;
        };
        var stringToUTF32 = (e, r, t) => {
          t ??= 2147483647;
          if (t < 4) {
            return 0;
          }
          var n = r;
          var a = n + t - 4;
          for (var o = 0; o < e.length; ++o) {
            var l = e.codePointAt(o);
            if (l > 65535) {
              o++;
            }
            HEAP32[r >> 2] = l;
            r += 4;
            if (r + 4 > a) {
              break;
            }
          }
          HEAP32[r >> 2] = 0;
          return r - n;
        };
        var lengthBytesUTF32 = e => {
          var r = 0;
          for (var t = 0; t < e.length; ++t) {
            var n = e.codePointAt(t);
            if (n > 65535) {
              t++;
            }
            r += 4;
          }
          return r;
        };
        var _emscripten_html5_remove_event_listener = (e, r, t, n) => {
          var a = {
            target: findEventTarget(e),
            userData: r,
            eventTypeId: t,
            callbackfunc: n
          };
          return JSEvents.removeSingleHandler(a);
        };
        _emscripten_html5_remove_event_listener.sig = "ippip";
        var _emscripten_set_click_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 4, "click", a);
        _emscripten_set_click_callback_on_thread.sig = "ippipp";
        var _emscripten_set_dblclick_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 7, "dblclick", a);
        _emscripten_set_dblclick_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mouseover_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 35, "mouseover", a);
        _emscripten_set_mouseover_callback_on_thread.sig = "ippipp";
        var _emscripten_set_mouseout_callback_on_thread = (e, r, t, n, a) => registerMouseEventCallback(e, r, t, n, 36, "mouseout", a);
        _emscripten_set_mouseout_callback_on_thread.sig = "ippipp";
        var _emscripten_set_scroll_callback_on_thread = (e, r, t, n, a) => registerUiEventCallback(e, r, t, n, 11, "scroll", a);
        _emscripten_set_scroll_callback_on_thread.sig = "ippipp";
        var _emscripten_set_focusin_callback_on_thread = (e, r, t, n, a) => registerFocusEventCallback(e, r, t, n, 14, "focusin", a);
        _emscripten_set_focusin_callback_on_thread.sig = "ippipp";
        var _emscripten_set_focusout_callback_on_thread = (e, r, t, n, a) => registerFocusEventCallback(e, r, t, n, 15, "focusout", a);
        _emscripten_set_focusout_callback_on_thread.sig = "ippipp";
        var fillDeviceOrientationEventData = (e, r, t) => {
          HEAPF64[e >> 3] = r.alpha;
          HEAPF64[e + 8 >> 3] = r.beta;
          HEAPF64[e + 16 >> 3] = r.gamma;
          HEAP8[e + 24] = r.absolute;
        };
        var registerDeviceOrientationEventCallback = (e, r, t, n, a, o, l) => {
          var c = 32;
          JSEvents.deviceOrientationEvent ||= _malloc(c);
          var _ = m => {
            fillDeviceOrientationEventData(JSEvents.deviceOrientationEvent, m, e);
            if (getWasmTableEntry(n)(a, JSEvents.deviceOrientationEvent, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_deviceorientation_callback_on_thread = (e, r, t, n) => registerDeviceOrientationEventCallback(2, e, r, t, 16, "deviceorientation", n);
        _emscripten_set_deviceorientation_callback_on_thread.sig = "ipipp";
        var fillDeviceMotionEventData = (e, r, t) => {
          var n = 0;
          var a = r.acceleration;
          n |= a && 1;
          var o = r.accelerationIncludingGravity;
          n |= o && 2;
          var l = r.rotationRate;
          n |= l && 4;
          a = a || {};
          o = o || {};
          l = l || {};
          HEAP32[e + 72 >> 2] = n;
          HEAPF64[e >> 3] = a.x;
          HEAPF64[e + 8 >> 3] = a.y;
          HEAPF64[e + 16 >> 3] = a.z;
          HEAPF64[e + 24 >> 3] = o.x;
          HEAPF64[e + 32 >> 3] = o.y;
          HEAPF64[e + 40 >> 3] = o.z;
          HEAPF64[e + 48 >> 3] = l.alpha;
          HEAPF64[e + 56 >> 3] = l.beta;
          HEAPF64[e + 64 >> 3] = l.gamma;
        };
        var registerDeviceMotionEventCallback = (e, r, t, n, a, o, l) => {
          var c = 80;
          JSEvents.deviceMotionEvent ||= _malloc(c);
          var _ = m => {
            fillDeviceMotionEventData(JSEvents.deviceMotionEvent, m, e);
            if (getWasmTableEntry(n)(a, JSEvents.deviceMotionEvent, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_devicemotion_callback_on_thread = (e, r, t, n) => registerDeviceMotionEventCallback(2, e, r, t, 17, "devicemotion", n);
        _emscripten_set_devicemotion_callback_on_thread.sig = "ipipp";
        var screenOrientation = () => {
          if (window.screen) {
            return screen.orientation || screen.mozOrientation || screen.webkitOrientation;
          }
        };
        var fillOrientationChangeEventData = e => {
          var r = ["portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"];
          var t = ["portrait", "portrait", "landscape", "landscape"];
          var n = 0;
          var a = 0;
          var o = screenOrientation();
          if (typeof o == "object") {
            n = r.indexOf(o.type);
            if (n < 0) {
              n = t.indexOf(o.type);
            }
            if (n >= 0) {
              n = 1 << n;
            }
            a = o.angle;
          } else {
            a = window.orientation;
          }
          HEAP32[e >> 2] = n;
          HEAP32[e + 4 >> 2] = a;
        };
        var registerOrientationChangeEventCallback = (e, r, t, n, a, o, l) => {
          var c = 8;
          JSEvents.orientationChangeEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.orientationChangeEvent;
            fillOrientationChangeEventData(f);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_orientationchange_callback_on_thread = (e, r, t, n) => !window.screen || !screen.orientation ? -1 : registerOrientationChangeEventCallback(screen.orientation, e, r, t, 18, "change", n);
        _emscripten_set_orientationchange_callback_on_thread.sig = "ipipp";
        var _emscripten_get_orientation_status = e => !screenOrientation() && typeof orientation === "undefined" ? -1 : (fillOrientationChangeEventData(e), 0);
        _emscripten_get_orientation_status.sig = "ip";
        var _emscripten_lock_orientation = e => {
          var r = [];
          if (e & 1) {
            r.push("portrait-primary");
          }
          if (e & 2) {
            r.push("portrait-secondary");
          }
          if (e & 4) {
            r.push("landscape-primary");
          }
          if (e & 8) {
            r.push("landscape-secondary");
          }
          var t;
          if (screen.lockOrientation) {
            t = screen.lockOrientation(r);
          } else if (screen.mozLockOrientation) {
            t = screen.mozLockOrientation(r);
          } else if (screen.webkitLockOrientation) {
            t = screen.webkitLockOrientation(r);
          } else {
            return -1;
          }
          if (t) {
            return 0;
          } else {
            return -6;
          }
        };
        _emscripten_lock_orientation.sig = "ii";
        var _emscripten_unlock_orientation = () => {
          if (screen.unlockOrientation) {
            screen.unlockOrientation();
          } else if (screen.mozUnlockOrientation) {
            screen.mozUnlockOrientation();
          } else if (screen.webkitUnlockOrientation) {
            screen.webkitUnlockOrientation();
          } else {
            return -1;
          }
          return 0;
        };
        _emscripten_unlock_orientation.sig = "i";
        var _emscripten_get_fullscreen_status = e => JSEvents.fullscreenEnabled() ? (fillFullscreenChangeEventData(e), 0) : -1;
        _emscripten_get_fullscreen_status.sig = "ip";
        var hideEverythingExceptGivenElement = e => {
          for (var r = e, t = r.parentNode, n = []; r != document.body;) {
            var a = t.children;
            for (var o of a) {
              if (o != r) {
                n.push({
                  node: o,
                  displayState: o.style.display
                });
                o.style.display = "none";
              }
            }
            r = t;
            t = t.parentNode;
          }
          return n;
        };
        var restoreHiddenElements = e => {
          for (var r of e) {
            r.node.style.display = r.displayState;
          }
        };
        var restoreOldWindowedStyle = null;
        var softFullscreenResizeWebGLRenderTarget = () => {
          var e = devicePixelRatio;
          var r = currentFullscreenStrategy.canvasResolutionScaleMode == 2;
          var t = currentFullscreenStrategy.scaleMode == 2;
          var n = currentFullscreenStrategy.canvasResolutionScaleMode != 0;
          var a = currentFullscreenStrategy.scaleMode == 3;
          var o = r ? Math.round(innerWidth * e) : innerWidth;
          var l = r ? Math.round(innerHeight * e) : innerHeight;
          var c = o;
          var _ = l;
          var u = currentFullscreenStrategy.target;
          var m = getCanvasElementSize(u);
          var f = m[0];
          var v = m[1];
          var g;
          if (t) {
            if (c * v < f * _) {
              _ = c * v / f | 0;
            } else if (c * v > f * _) {
              c = _ * f / v | 0;
            }
            g = (l - _) / 2 | 0;
          }
          if (n) {
            setCanvasElementSize(u, c, _);
            if (u.GLctxObject) {
              u.GLctxObject.GLctx.viewport(0, 0, c, _);
            }
          }
          if (r) {
            g /= e;
            c /= e;
            _ /= e;
            c = Math.round(c * 10000) / 10000;
            _ = Math.round(_ * 10000) / 10000;
            g = Math.round(g * 10000) / 10000;
          }
          if (a) {
            var h = (innerHeight - jstoi_q(u.style.height)) / 2;
            var p = (innerWidth - jstoi_q(u.style.width)) / 2;
            setLetterbox(u, h, p);
          } else {
            u.style.width = c + "px";
            u.style.height = _ + "px";
            var p = (innerWidth - c) / 2;
            setLetterbox(u, g, p);
          }
          if (!a && currentFullscreenStrategy.canvasResizedCallback) {
            getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(37, 0, currentFullscreenStrategy.canvasResizedCallbackUserData);
          }
        };
        var _emscripten_request_fullscreen = (e, r) => {
          var t = {
            scaleMode: 0,
            canvasResolutionScaleMode: 0,
            filteringMode: 0,
            deferUntilInEventHandler: r,
            canvasResizedCallbackTargetThread: 2
          };
          return doRequestFullscreen(e, t);
        };
        _emscripten_request_fullscreen.sig = "ipi";
        var _emscripten_enter_soft_fullscreen = (e, r) => {
          e = findEventTarget(e);
          if (!e) {
            return -4;
          }
          var t = {
            scaleMode: HEAP32[r >> 2],
            canvasResolutionScaleMode: HEAP32[r + 4 >> 2],
            filteringMode: HEAP32[r + 8 >> 2],
            canvasResizedCallback: HEAP32[r + 12 >> 2],
            canvasResizedCallbackUserData: HEAP32[r + 16 >> 2],
            target: e,
            softFullscreen: true
          };
          var n = JSEvents_resizeCanvasForFullscreen(e, t);
          document.documentElement.style.overflow = "hidden";
          document.body.scroll = "no";
          document.body.style.margin = "0px";
          var a = hideEverythingExceptGivenElement(e);
          function o() {
            n();
            restoreHiddenElements(a);
            removeEventListener("resize", softFullscreenResizeWebGLRenderTarget);
            if (t.canvasResizedCallback) {
              getWasmTableEntry(t.canvasResizedCallback)(37, 0, t.canvasResizedCallbackUserData);
            }
            currentFullscreenStrategy = 0;
          }
          restoreOldWindowedStyle = o;
          currentFullscreenStrategy = t;
          addEventListener("resize", softFullscreenResizeWebGLRenderTarget);
          if (t.canvasResizedCallback) {
            getWasmTableEntry(t.canvasResizedCallback)(37, 0, t.canvasResizedCallbackUserData);
          }
          return 0;
        };
        _emscripten_enter_soft_fullscreen.sig = "ipp";
        var _emscripten_exit_soft_fullscreen = () => {
          restoreOldWindowedStyle?.();
          restoreOldWindowedStyle = null;
          return 0;
        };
        _emscripten_exit_soft_fullscreen.sig = "i";
        var registerPointerlockErrorEventCallback = (e, r, t, n, a, o, l) => {
          var c = u => {
            if (getWasmTableEntry(n)(a, 0, r)) {
              u.preventDefault();
            }
          };
          var _ = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: c,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(_);
        };
        var _emscripten_set_pointerlockerror_callback_on_thread = (e, r, t, n, a) => document.body?.requestPointerLock ? (e = findEventTarget(e), e ? registerPointerlockErrorEventCallback(e, r, t, n, 38, "pointerlockerror", a) : -4) : -1;
        _emscripten_set_pointerlockerror_callback_on_thread.sig = "ippipp";
        var _emscripten_get_pointerlock_status = e => {
          if (e) {
            fillPointerlockChangeEventData(e);
          }
          if (document.body?.requestPointerLock) {
            return 0;
          } else {
            return -1;
          }
        };
        _emscripten_get_pointerlock_status.sig = "ip";
        var _emscripten_vibrate = e => navigator.vibrate ? (navigator.vibrate(e), 0) : -1;
        _emscripten_vibrate.sig = "ii";
        var _emscripten_vibrate_pattern = (e, r) => {
          if (!navigator.vibrate) {
            return -1;
          }
          var t = [];
          for (var n = 0; n < r; ++n) {
            var a = HEAP32[e + n * 4 >> 2];
            t.push(a);
          }
          navigator.vibrate(t);
          return 0;
        };
        _emscripten_vibrate_pattern.sig = "ipi";
        var _emscripten_get_visibility_status = e => typeof document.visibilityState === "undefined" && typeof document.hidden === "undefined" ? -1 : (fillVisibilityChangeEventData(e), 0);
        _emscripten_get_visibility_status.sig = "ip";
        var registerBatteryEventCallback = (e, r, t, n, a, o, l) => {
          var c = 32;
          JSEvents.batteryEvent ||= _malloc(c);
          var _ = m => {
            var f = JSEvents.batteryEvent;
            fillBatteryEventData(f, e);
            if (getWasmTableEntry(n)(a, f, r)) {
              m.preventDefault();
            }
          };
          var u = {
            target: e,
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: _,
            useCapture: t
          };
          return JSEvents.registerOrRemoveHandler(u);
        };
        var _emscripten_set_batterychargingchange_callback_on_thread = (e, r, t) => {
          if (!hasBatteryAPI()) {
            return -1;
          }
          navigator.getBattery().then(n => {
            registerBatteryEventCallback(n, e, true, r, 29, "chargingchange", t);
          });
        };
        _emscripten_set_batterychargingchange_callback_on_thread.sig = "ippp";
        var _emscripten_set_batterylevelchange_callback_on_thread = (e, r, t) => {
          if (!hasBatteryAPI()) {
            return -1;
          }
          navigator.getBattery().then(n => {
            registerBatteryEventCallback(n, e, true, r, 30, "levelchange", t);
          });
        };
        _emscripten_set_batterylevelchange_callback_on_thread.sig = "ippp";
        var _emscripten_html5_remove_all_event_listeners = () => JSEvents.removeAllEventListeners();
        _emscripten_html5_remove_all_event_listeners.sig = "v";
        var _emscripten_request_animation_frame = (e, r) => requestAnimationFrame(t => getWasmTableEntry(e)(t, r));
        _emscripten_request_animation_frame.sig = "ipp";
        var _emscripten_cancel_animation_frame = e => cancelAnimationFrame(e);
        _emscripten_cancel_animation_frame.sig = "vi";
        var _emscripten_request_animation_frame_loop = (e, r) => {
          function t(n) {
            if (getWasmTableEntry(e)(n, r)) {
              requestAnimationFrame(t);
            }
          }
          return requestAnimationFrame(t);
        };
        _emscripten_request_animation_frame_loop.sig = "vpp";
        var _emscripten_get_callstack = (e, r, t) => {
          var n = getCallstack(e);
          if (!r || t <= 0) {
            return lengthBytesUTF8(n) + 1;
          }
          var a = stringToUTF8(n, r, t);
          return a + 1;
        };
        _emscripten_get_callstack.sig = "iipi";
        var convertFrameToPC = e => {
          var r;
          if (r = /\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(e)) {
            return +r[1];
          } else if (r = /:(\d+):\d+(?:\)|$)/.exec(e)) {
            return +r[1] | -2147483648;
          } else {
            return 0;
          }
        };
        var _emscripten_return_address = e => {
          var r = jsStackTrace().split(`
`);
          if (r[0] == "Error") {
            r.shift();
          }
          var t = r[e + 3];
          return convertFrameToPC(t);
        };
        _emscripten_return_address.sig = "pi";
        var UNWIND_CACHE = {};
        var saveInUnwindCache = e => {
          for (var r of e) {
            var t = convertFrameToPC(r);
            if (t) {
              UNWIND_CACHE[t] = r;
            }
          }
        };
        var _emscripten_stack_snapshot = () => {
          var e = jsStackTrace().split(`
`);
          if (e[0] == "Error") {
            e.shift();
          }
          saveInUnwindCache(e);
          UNWIND_CACHE.last_addr = convertFrameToPC(e[3]);
          UNWIND_CACHE.last_stack = e;
          return UNWIND_CACHE.last_addr;
        };
        _emscripten_stack_snapshot.sig = "p";
        var _emscripten_stack_unwind_buffer = (e, r, t) => {
          var n;
          if (UNWIND_CACHE.last_addr == e) {
            n = UNWIND_CACHE.last_stack;
          } else {
            n = jsStackTrace().split(`
`);
            if (n[0] == "Error") {
              n.shift();
            }
            saveInUnwindCache(n);
          }
          for (var a = 3; n[a] && convertFrameToPC(n[a]) != e;) {
            ++a;
          }
          for (var o = 0; o < t && n[o + a]; ++o) {
            HEAP32[r + o * 4 >> 2] = convertFrameToPC(n[o + a]);
          }
          return o;
        };
        _emscripten_stack_unwind_buffer.sig = "ippi";
        var _emscripten_pc_get_function = e => {
          var r = UNWIND_CACHE[e];
          if (!r) {
            return 0;
          }
          var t;
          var n;
          if (n = /^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(r)) {
            t = n[1];
          } else if (n = /^\s+at (.*) \(.*\)$/.exec(r)) {
            t = n[1];
          } else if (n = /^(.+?)@/.exec(r)) {
            t = n[1];
          } else {
            return 0;
          }
          _free(_emscripten_pc_get_function.ret ?? 0);
          _emscripten_pc_get_function.ret = stringToNewUTF8(t);
          return _emscripten_pc_get_function.ret;
        };
        _emscripten_pc_get_function.sig = "pp";
        var convertPCtoSourceLocation = e => {
          if (UNWIND_CACHE.last_get_source_pc == e) {
            return UNWIND_CACHE.last_source;
          }
          var r;
          var t;
          if (!t) {
            var n = UNWIND_CACHE[e];
            if (!n) {
              return null;
            }
            if (r = /\((.*):(\d+):(\d+)\)$/.exec(n)) {
              t = {
                file: r[1],
                line: r[2],
                column: r[3]
              };
            } else if (r = /@(.*):(\d+):(\d+)/.exec(n)) {
              t = {
                file: r[1],
                line: r[2],
                column: r[3]
              };
            }
          }
          UNWIND_CACHE.last_get_source_pc = e;
          UNWIND_CACHE.last_source = t;
          return t;
        };
        var _emscripten_pc_get_file = e => {
          var r = convertPCtoSourceLocation(e);
          if (r) {
            _free(_emscripten_pc_get_file.ret ?? 0);
            _emscripten_pc_get_file.ret = stringToNewUTF8(r.file);
            return _emscripten_pc_get_file.ret;
          } else {
            return 0;
          }
        };
        _emscripten_pc_get_file.sig = "pp";
        var _emscripten_pc_get_line = e => {
          var r = convertPCtoSourceLocation(e);
          if (r) {
            return r.line;
          } else {
            return 0;
          }
        };
        _emscripten_pc_get_line.sig = "ip";
        var _emscripten_pc_get_column = e => {
          var r = convertPCtoSourceLocation(e);
          return r && r.column || 0;
        };
        _emscripten_pc_get_column.sig = "ip";
        var _sched_yield = () => 0;
        _sched_yield.sig = "i";
        var wasiRightsToMuslOFlags = e => {
          if (e & 2 && e & 64) {
            return 2;
          }
          if (e & 2) {
            return 0;
          }
          if (e & 64) {
            return 1;
          }
          throw new FS.ErrnoError(28);
        };
        var wasiOFlagsToMuslOFlags = e => {
          var r = 0;
          if (e & 1) {
            r |= 64;
          }
          if (e & 8) {
            r |= 512;
          }
          if (e & 2) {
            r |= 65536;
          }
          if (e & 4) {
            r |= 128;
          }
          return r;
        };
        var _emscripten_unwind_to_js_event_loop = () => {
          throw "unwind";
        };
        _emscripten_unwind_to_js_event_loop.sig = "v";
        var setImmediateWrapped = e => {
          setImmediateWrapped.mapping ||= [];
          var r = setImmediateWrapped.mapping.length;
          setImmediateWrapped.mapping[r] = setImmediate(() => {
            setImmediateWrapped.mapping[r] = undefined;
            e();
          });
          return r;
        };
        var safeRequestAnimationFrame = e => MainLoop.requestAnimationFrame(() => {
          callUserCallback(e);
        });
        var clearImmediateWrapped = e => {
          clearImmediate(setImmediateWrapped.mapping[e]);
          setImmediateWrapped.mapping[e] = undefined;
        };
        var emClearImmediate;
        var emSetImmediate;
        var emClearImmediate_deps = ["$emSetImmediate"];
        var _emscripten_set_immediate = (e, r) => emSetImmediate(() => {
          callUserCallback(() => getWasmTableEntry(e)(r));
        });
        _emscripten_set_immediate.sig = "ipp";
        var _emscripten_clear_immediate = e => {
          emClearImmediate(e);
        };
        _emscripten_clear_immediate.sig = "vi";
        var _emscripten_set_immediate_loop = (e, r) => {
          function t() {
            callUserCallback(() => {
              if (getWasmTableEntry(e)(r)) {
                emSetImmediate(t);
              }
            });
          }
          emSetImmediate(t);
        };
        _emscripten_set_immediate_loop.sig = "vpp";
        var _emscripten_set_timeout_loop = (e, r, t) => {
          function n() {
            var a = _emscripten_get_now();
            var o = a + r;
            callUserCallback(() => {
              if (getWasmTableEntry(e)(a, t)) {
                var l = o - _emscripten_get_now();
                setTimeout(n, l);
              }
            });
          }
          return setTimeout(n, 0);
        };
        _emscripten_set_timeout_loop.sig = "vpdp";
        var _emscripten_set_interval = (e, r, t) => setInterval(() => {
          callUserCallback(() => getWasmTableEntry(e)(t));
        }, r);
        _emscripten_set_interval.sig = "ipdp";
        var _emscripten_clear_interval = e => {
          clearInterval(e);
        };
        _emscripten_clear_interval.sig = "vi";
        var _emscripten_async_call = (e, r, t) => {
          var n = () => getWasmTableEntry(e)(r);
          if (t >= 0) {
            safeSetTimeout(n, t);
          } else {
            safeRequestAnimationFrame(n);
          }
        };
        _emscripten_async_call.sig = "vppi";
        var registerPostMainLoop = e => {
          if (typeof MainLoop !== "undefined") {
            MainLoop.postMainLoop.push(e);
          }
        };
        var _emscripten_get_main_loop_timing = (e, r) => {
          if (e) {
            HEAP32[e >> 2] = MainLoop.timingMode;
          }
          if (r) {
            HEAP32[r >> 2] = MainLoop.timingValue;
          }
        };
        _emscripten_get_main_loop_timing.sig = "vpp";
        var _emscripten_set_main_loop = (e, r, t) => {
          var n = getWasmTableEntry(e);
          setMainLoop(n, r, t);
        };
        _emscripten_set_main_loop.sig = "vpii";
        var _emscripten_pause_main_loop = () => MainLoop.pause();
        _emscripten_pause_main_loop.sig = "v";
        var _emscripten_resume_main_loop = () => MainLoop.resume();
        _emscripten_resume_main_loop.sig = "v";
        var __emscripten_push_main_loop_blocker = (e, r, t) => {
          MainLoop.queue.push({
            func: () => {
              getWasmTableEntry(e)(r);
            },
            name: UTF8ToString(t),
            counted: true
          });
          MainLoop.updateStatus();
        };
        __emscripten_push_main_loop_blocker.sig = "vppp";
        var __emscripten_push_uncounted_main_loop_blocker = (e, r, t) => {
          MainLoop.queue.push({
            func: () => {
              getWasmTableEntry(e)(r);
            },
            name: UTF8ToString(t),
            counted: false
          });
          MainLoop.updateStatus();
        };
        __emscripten_push_uncounted_main_loop_blocker.sig = "vppp";
        var _emscripten_set_main_loop_expected_blockers = e => {
          MainLoop.expectedBlockers = e;
          MainLoop.remainingBlockers = e;
          MainLoop.updateStatus();
        };
        _emscripten_set_main_loop_expected_blockers.sig = "vi";
        var idsToPromises = (e, r) => {
          var t = [];
          for (var n = 0; n < r; n++) {
            var a = HEAP32[e + n * 4 >> 2];
            t[n] = getPromise(a);
          }
          return t;
        };
        var makePromiseCallback = (e, r) => t => {
          var n = stackSave();
          var a = stackAlloc(POINTER_SIZE);
          HEAPU32[a >> 2] = 0;
          try {
            var o = getWasmTableEntry(e)(a, r, t);
            var l = HEAPU32[a >> 2];
          } catch (_) {
            throw typeof _ != "number" ? 0 : _;
          } finally {
            stackRestore(n);
          }
          switch (o) {
            case 0:
              return l;
            case 1:
              return getPromise(l);
            case 2:
              var c = getPromise(l);
              _emscripten_promise_destroy(l);
              return c;
            case 3:
              throw l;
          }
        };
        var _emscripten_promise_then = (e, r, t, n) => {
          var a = getPromise(e);
          var o = promiseMap.allocate({
            promise: a.then(makePromiseCallback(r, n), makePromiseCallback(t, n))
          });
          return o;
        };
        _emscripten_promise_then.sig = "ppppp";
        var _emscripten_promise_all = (e, r, t) => {
          var n = idsToPromises(e, t);
          var a = promiseMap.allocate({
            promise: Promise.all(n).then(o => {
              if (r) {
                for (var l = 0; l < t; l++) {
                  var c = o[l];
                  HEAPU32[r + l * 4 >> 2] = c;
                }
              }
              return r;
            })
          });
          return a;
        };
        _emscripten_promise_all.sig = "pppp";
        var setPromiseResult = (e, r, t) => {
          var n = r ? 0 : 3;
          HEAP32[e >> 2] = n;
          HEAPU32[e + 4 >> 2] = t;
        };
        var _emscripten_promise_all_settled = (e, r, t) => {
          var n = idsToPromises(e, t);
          var a = promiseMap.allocate({
            promise: Promise.allSettled(n).then(o => {
              if (r) {
                for (var l = r, c = 0; c < t; c++, l += 8) {
                  if (o[c].status === "fulfilled") {
                    setPromiseResult(l, true, o[c].value);
                  } else {
                    setPromiseResult(l, false, o[c].reason);
                  }
                }
              }
              return r;
            })
          });
          return a;
        };
        _emscripten_promise_all_settled.sig = "pppp";
        var _emscripten_promise_any = (e, r, t) => {
          var n = idsToPromises(e, t);
          var a = promiseMap.allocate({
            promise: Promise.any(n).catch(o => {
              if (r) {
                for (var l = 0; l < t; l++) {
                  HEAPU32[r + l * 4 >> 2] = o.errors[l];
                }
              }
              throw r;
            })
          });
          return a;
        };
        _emscripten_promise_any.sig = "pppp";
        var _emscripten_promise_race = (e, r) => {
          var t = idsToPromises(e, r);
          var n = promiseMap.allocate({
            promise: Promise.race(t)
          });
          return n;
        };
        _emscripten_promise_race.sig = "ppp";
        var _emscripten_promise_await = (e, r) => {
          abort("emscripten_promise_await is only available with ASYNCIFY");
        };
        _emscripten_promise_await.sig = "vpp";
        var findMatchingCatch = e => {
          var r = exceptionLast;
          if (!r) {
            setTempRet0(0);
            return 0;
          }
          var t = new ExceptionInfo(r);
          t.set_adjusted_ptr(r);
          var n = t.get_type();
          if (!n) {
            setTempRet0(0);
            return r;
          }
          for (var a of e) {
            if (a === 0 || a === n) {
              break;
            }
            var o = t.ptr + 16;
            if (___cxa_can_catch(a, n, o)) {
              setTempRet0(a);
              return r;
            }
          }
          setTempRet0(n);
          return r;
        };
        var ___cxa_find_matching_catch_2 = () => findMatchingCatch([]);
        ___cxa_find_matching_catch_2.sig = "p";
        var ___cxa_find_matching_catch_3 = e => findMatchingCatch([e]);
        ___cxa_find_matching_catch_3.sig = "pp";
        var ___cxa_find_matching_catch_4 = (e, r) => findMatchingCatch([e, r]);
        ___cxa_find_matching_catch_4.sig = "ppp";
        var exceptionCaught = [];
        var ___cxa_rethrow = () => {
          var e = exceptionCaught.pop();
          if (!e) {
            abort("no exception to throw");
          }
          var r = e.excPtr;
          if (!e.get_rethrown()) {
            exceptionCaught.push(e);
            e.set_rethrown(true);
            e.set_caught(false);
            uncaughtExceptionCount++;
          }
          exceptionLast = r;
          throw exceptionLast;
        };
        ___cxa_rethrow.sig = "v";
        var _llvm_eh_typeid_for = e => e;
        _llvm_eh_typeid_for.sig = "vp";
        var ___cxa_begin_catch = e => {
          var r = new ExceptionInfo(e);
          if (!r.get_caught()) {
            r.set_caught(true);
            uncaughtExceptionCount--;
          }
          r.set_rethrown(false);
          exceptionCaught.push(r);
          return ___cxa_get_exception_ptr(e);
        };
        ___cxa_begin_catch.sig = "pp";
        var ___cxa_end_catch = () => {
          _setThrew(0, 0);
          var e = exceptionCaught.pop();
          ___cxa_decrement_exception_refcount(e.excPtr);
          exceptionLast = 0;
        };
        ___cxa_end_catch.sig = "v";
        var ___cxa_uncaught_exceptions = () => uncaughtExceptionCount;
        ___cxa_uncaught_exceptions.sig = "i";
        var ___cxa_call_unexpected = e => abort("Unexpected exception thrown, this is not properly supported - aborting");
        ___cxa_call_unexpected.sig = "vp";
        var ___cxa_current_primary_exception = () => {
          if (!exceptionCaught.length) {
            return 0;
          }
          var e = exceptionCaught[exceptionCaught.length - 1];
          ___cxa_increment_exception_refcount(e.excPtr);
          return e.excPtr;
        };
        ___cxa_current_primary_exception.sig = "p";
        function ___cxa_current_exception_type() {
          if (!exceptionCaught.length) {
            return 0;
          }
          var e = exceptionCaught[exceptionCaught.length - 1];
          return e.get_type();
        }
        ___cxa_current_exception_type.sig = "p";
        var ___cxa_rethrow_primary_exception = e => {
          if (e) {
            var r = new ExceptionInfo(e);
            exceptionCaught.push(r);
            r.set_rethrown(true);
            ___cxa_rethrow();
          }
        };
        ___cxa_rethrow_primary_exception.sig = "vp";
        var ___resumeException = e => {
          exceptionLast ||= e;
          throw exceptionLast;
        };
        ___resumeException.sig = "vp";
        var requestFullscreen = Browser.requestFullscreen;
        var setCanvasSize = Browser.setCanvasSize;
        var getUserMedia = Browser.getUserMedia;
        var _emscripten_run_preload_plugins = (e, r, t) => {
          var n = UTF8ToString(e);
          var a = FS.analyzePath(n);
          if (a.exists) {
            FS.createPreloadedFile(PATH.dirname(n), PATH.basename(n), new Uint8Array(a.object.contents), true, true, () => {
              if (r) {
                getWasmTableEntry(r)(e);
              }
            }, () => {
              if (t) {
                getWasmTableEntry(t)(e);
              }
            }, true);
            return 0;
          } else {
            return -1;
          }
        };
        _emscripten_run_preload_plugins.sig = "ippp";
        var Browser_asyncPrepareDataCounter = 0;
        var _emscripten_run_preload_plugins_data = (e, r, t, n, a, o) => {
          var l = UTF8ToString(t);
          var c = "prepare_data_" + Browser_asyncPrepareDataCounter++ + "." + l;
          var _ = stringToNewUTF8(c);
          FS.createPreloadedFile("/", c, HEAPU8.subarray(e, e + r), true, true, () => {
            if (a) {
              getWasmTableEntry(a)(n, _);
            }
          }, () => {
            if (o) {
              getWasmTableEntry(o)(n);
            }
          }, true);
        };
        _emscripten_run_preload_plugins_data.sig = "vpipppp";
        var _emscripten_async_run_script = (e, r) => {
          safeSetTimeout(() => _emscripten_run_script(e), r);
        };
        _emscripten_async_run_script.sig = "vpi";
        var _emscripten_async_load_script = async (e, r, t) => {
          e = UTF8ToString(e);
          var n = () => {
            if (r) {
              var l = () => callUserCallback(getWasmTableEntry(r));
              if (runDependencies > 0) {
                dependenciesFulfilled = l;
              } else {
                l();
              }
            }
          };
          var a = () => {
            if (t) {
              callUserCallback(getWasmTableEntry(t));
            }
          };
          var o = document.createElement("script");
          o.onload = n;
          o.onerror = a;
          o.src = e;
          document.body.appendChild(o);
        };
        _emscripten_async_load_script.sig = "vppp";
        var _emscripten_get_window_title = () => {
          var e = 256;
          _emscripten_get_window_title.buffer ||= _malloc(e);
          stringToUTF8(document.title, _emscripten_get_window_title.buffer, e);
          return _emscripten_get_window_title.buffer;
        };
        _emscripten_get_window_title.sig = "p";
        var _emscripten_hide_mouse = () => {
          var e = document.styleSheets[0];
          for (var r = e.cssRules, t = 0; t < r.length; t++) {
            if (r[t].cssText.startsWith("canvas")) {
              e.deleteRule(t);
              t--;
            }
          }
          e.insertRule("canvas.emscripten { border: 1px solid black; cursor: none; }", 0);
        };
        _emscripten_hide_mouse.sig = "v";
        var _emscripten_set_canvas_size = (e, r) => Browser.setCanvasSize(e, r);
        _emscripten_set_canvas_size.sig = "vii";
        var _emscripten_get_canvas_size = (e, r, t) => {
          var n = Browser.getCanvas();
          HEAP32[e >> 2] = n.width;
          HEAP32[r >> 2] = n.height;
          HEAP32[t >> 2] = Browser.isFullscreen ? 1 : 0;
        };
        _emscripten_get_canvas_size.sig = "vppp";
        var _emscripten_create_worker = e => {
          e = UTF8ToString(e);
          var r = Browser.workers.length;
          var t = {
            worker: new Worker(e),
            callbacks: [],
            awaited: 0,
            buffer: 0
          };
          t.worker.onmessage = function (a) {
            if (!ABORT) {
              var o = Browser.workers[r];
              if (o) {
                var l = a.data.callbackId;
                var c = o.callbacks[l];
                if (c) {
                  if (a.data.finalResponse) {
                    o.awaited--;
                    o.callbacks[l] = null;
                  }
                  var _ = a.data.data;
                  if (_) {
                    if (!_.byteLength) {
                      _ = new Uint8Array(_);
                    }
                    o.buffer = _realloc(o.buffer, _.length);
                    HEAPU8.set(_, o.buffer);
                    c.func(o.buffer, _.length, c.arg);
                  } else {
                    c.func(0, 0, c.arg);
                  }
                }
              }
            }
          };
          Browser.workers.push(t);
          return r;
        };
        _emscripten_create_worker.sig = "ip";
        var _emscripten_destroy_worker = e => {
          var r = Browser.workers[e];
          r.worker.terminate();
          _free(r.buffer);
          Browser.workers[e] = null;
        };
        _emscripten_destroy_worker.sig = "vi";
        var _emscripten_call_worker = (e, r, t, n, a, o) => {
          r = UTF8ToString(r);
          var l = Browser.workers[e];
          var c = -1;
          if (a) {
            c = l.callbacks.length;
            l.callbacks.push({
              func: getWasmTableEntry(a),
              arg: o
            });
            l.awaited++;
          }
          var _ = {
            funcName: r,
            callbackId: c,
            data: t ? new Uint8Array(HEAPU8.subarray(t, t + n)) : 0
          };
          if (t) {
            l.worker.postMessage(_, [_.data.buffer]);
          } else {
            l.worker.postMessage(_);
          }
        };
        _emscripten_call_worker.sig = "vippipp";
        var _emscripten_get_worker_queue_size = e => {
          var r = Browser.workers[e];
          if (r) {
            return r.awaited;
          } else {
            return -1;
          }
        };
        _emscripten_get_worker_queue_size.sig = "ii";
        var getPreloadedImageData = (e, r, t) => {
          e = PATH_FS.resolve(e);
          var n = Browser.preloadedImages[e];
          if (!n) {
            return 0;
          }
          var a = n.getContext("2d");
          var o = a.getImageData(0, 0, n.width, n.height);
          var l = _malloc(n.width * n.height * 4);
          HEAPU8.set(o.data, l);
          HEAP32[r >> 2] = n.width;
          HEAP32[t >> 2] = n.height;
          return l;
        };
        var _emscripten_get_preloaded_image_data = (e, r, t) => getPreloadedImageData(UTF8ToString(e), r, t);
        _emscripten_get_preloaded_image_data.sig = "pppp";
        var getPreloadedImageData__data = ["$PATH_FS", "malloc"];
        var _emscripten_get_preloaded_image_data_from_FILE = (e, r, t) => {
          var n = _fileno(e);
          var a = FS.getStream(n);
          if (a) {
            return getPreloadedImageData(a.path, r, t);
          } else {
            return 0;
          }
        };
        _emscripten_get_preloaded_image_data_from_FILE.sig = "pppp";
        var wget = {
          wgetRequests: {},
          nextWgetRequestHandle: 0,
          getNextWgetRequestHandle() {
            var e = wget.nextWgetRequestHandle;
            wget.nextWgetRequestHandle++;
            return e;
          }
        };
        var FS_mkdirTree = (e, r) => FS.mkdirTree(e, r);
        var FS_unlink = (...e) => FS.unlink(...e);
        var _emscripten_async_wget = (e, r, t, n) => {
          var a = UTF8ToString(e);
          var o = UTF8ToString(r);
          o = PATH_FS.resolve(o);
          function l(_) {
            if (_) {
              callUserCallback(() => withStackSave(() => getWasmTableEntry(_)(stringToUTF8OnStack(o))));
            }
          }
          var c = PATH.dirname(o);
          FS_preloadFile(c, PATH.basename(o), a, true, true, false, false, () => {
            try {
              FS_unlink(o);
            } catch {}
            FS_mkdirTree(c);
          }).then(() => l(t)).catch(() => l(n));
        };
        _emscripten_async_wget.sig = "vpppp";
        var _emscripten_async_wget_data = async (e, r, t, n) => {
          try {
            var a = await asyncLoad(UTF8ToString(e));
            callUserCallback(() => {
              var o = _malloc(a.length);
              HEAPU8.set(a, o);
              getWasmTableEntry(t)(r, o, a.length);
              _free(o);
            });
          } catch {
            if (n) {
              callUserCallback(() => {
                getWasmTableEntry(n)(r);
              });
            }
          }
        };
        _emscripten_async_wget_data.sig = "vpppp";
        var _emscripten_async_wget2 = (e, r, t, n, a, o, l, c) => {
          var _ = UTF8ToString(e);
          var u = UTF8ToString(r);
          u = PATH_FS.resolve(u);
          var m = UTF8ToString(t);
          var f = UTF8ToString(n);
          var v = u.lastIndexOf("/");
          var g = new XMLHttpRequest();
          g.open(m, _, true);
          g.responseType = "arraybuffer";
          var h = wget.getNextWgetRequestHandle();
          var p = PATH.dirname(u);
          g.onload = b => {
            if (g.status >= 200 && g.status < 300) {
              try {
                FS.unlink(u);
              } catch {}
              FS.mkdirTree(p);
              FS.createDataFile(u.slice(0, v), u.slice(v + 1), new Uint8Array(g.response), true, true, false);
              if (o) {
                var S = stackSave();
                getWasmTableEntry(o)(h, a, stringToUTF8OnStack(u));
                stackRestore(S);
              }
            } else if (l) {
              getWasmTableEntry(l)(h, a, g.status);
            }
            delete wget.wgetRequests[h];
          };
          g.onerror = b => {
            if (l) {
              getWasmTableEntry(l)(h, a, g.status);
            }
            delete wget.wgetRequests[h];
          };
          g.onprogress = b => {
            if (b.lengthComputable || b.lengthComputable === undefined && b.total != 0) {
              var S = b.loaded / b.total * 100;
              if (c) {
                getWasmTableEntry(c)(h, a, S);
              }
            }
          };
          g.onabort = b => {
            delete wget.wgetRequests[h];
          };
          if (m == "POST") {
            g.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            g.send(f);
          } else {
            g.send(null);
          }
          wget.wgetRequests[h] = g;
          return h;
        };
        _emscripten_async_wget2.sig = "ipppppppp";
        var _emscripten_async_wget2_data = (e, r, t, n, a, o, l, c) => {
          var _ = UTF8ToString(e);
          var u = UTF8ToString(r);
          var m = UTF8ToString(t);
          var f = new XMLHttpRequest();
          f.open(u, _, true);
          f.responseType = "arraybuffer";
          var v = wget.getNextWgetRequestHandle();
          function g() {
            if (l) {
              var h = stackSave();
              var p = 0;
              if (f.statusText) {
                p = stringToUTF8OnStack(f.statusText);
              }
              getWasmTableEntry(l)(v, n, f.status, p);
              stackRestore(h);
            }
          }
          f.onload = h => {
            if (f.status >= 200 && f.status < 300 || f.status === 0 && _.slice(0, 4).toLowerCase() != "http") {
              var p = new Uint8Array(f.response);
              var b = _malloc(p.length);
              HEAPU8.set(p, b);
              if (o) {
                getWasmTableEntry(o)(v, n, b, p.length);
              }
              if (a) {
                _free(b);
              }
            } else {
              g();
            }
            delete wget.wgetRequests[v];
          };
          f.onerror = h => {
            g();
            delete wget.wgetRequests[v];
          };
          f.onprogress = h => {
            if (c) {
              getWasmTableEntry(c)(v, n, h.loaded, h.lengthComputable || h.lengthComputable === undefined ? h.total : 0);
            }
          };
          f.onabort = h => {
            delete wget.wgetRequests[v];
          };
          if (u == "POST") {
            f.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            f.send(m);
          } else {
            f.send(null);
          }
          wget.wgetRequests[v] = f;
          return v;
        };
        _emscripten_async_wget2_data.sig = "ippppippp";
        var _emscripten_async_wget2_abort = e => {
          var r = wget.wgetRequests[e];
          r?.abort();
        };
        _emscripten_async_wget2_abort.sig = "vi";
        var ___asctime_r = (e, r) => {
          var t = {
            tm_sec: HEAP32[e >> 2],
            tm_min: HEAP32[e + 4 >> 2],
            tm_hour: HEAP32[e + 8 >> 2],
            tm_mday: HEAP32[e + 12 >> 2],
            tm_mon: HEAP32[e + 16 >> 2],
            tm_year: HEAP32[e + 20 >> 2],
            tm_wday: HEAP32[e + 24 >> 2]
          };
          var n = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          var a = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          var o = `${n[t.tm_wday] + " " + a[t.tm_mon] + (t.tm_mday < 10 ? "  " : " ") + t.tm_mday + (t.tm_hour < 10 ? " 0" : " ") + t.tm_hour + (t.tm_min < 10 ? ":0" : ":") + t.tm_min + (t.tm_sec < 10 ? ":0" : ":") + t.tm_sec + " " + (1900 + t.tm_year)}
`;
          stringToUTF8(o, r, 26);
          return r;
        };
        ___asctime_r.sig = "ppp";
        var MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var arraySum = (e, r) => {
          for (var t = 0, n = 0; n <= r; t += e[n++]);
          return t;
        };
        var addDays = (e, r) => {
          var t = new Date(e.getTime());
          for (; r > 0;) {
            var n = isLeapYear(t.getFullYear());
            var a = t.getMonth();
            var o = (n ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[a];
            if (r > o - t.getDate()) {
              r -= o - t.getDate() + 1;
              t.setDate(1);
              if (a < 11) {
                t.setMonth(a + 1);
              } else {
                t.setMonth(0);
                t.setFullYear(t.getFullYear() + 1);
              }
            } else {
              t.setDate(t.getDate() + r);
              return t;
            }
          }
          return t;
        };
        var _strptime = (e, r, t) => {
          var n = UTF8ToString(r);
          var a = "\\!@#$^&*()+=-[]/{}|:<>?,.";
          for (var o = 0, l = a.length; o < l; ++o) {
            n = n.replace(new RegExp("\\" + a[o], "g"), "\\" + a[o]);
          }
          var c = {
            A: "%a",
            B: "%b",
            c: "%a %b %d %H:%M:%S %Y",
            D: "%m\\/%d\\/%y",
            e: "%d",
            F: "%Y-%m-%d",
            h: "%b",
            R: "%H\\:%M",
            r: "%I\\:%M\\:%S\\s%p",
            T: "%H\\:%M\\:%S",
            x: "%m\\/%d\\/(?:%y|%Y)",
            X: "%H\\:%M\\:%S"
          };
          var _ = {
            a: "(?:Sun(?:day)?)|(?:Mon(?:day)?)|(?:Tue(?:sday)?)|(?:Wed(?:nesday)?)|(?:Thu(?:rsday)?)|(?:Fri(?:day)?)|(?:Sat(?:urday)?)",
            b: "(?:Jan(?:uary)?)|(?:Feb(?:ruary)?)|(?:Mar(?:ch)?)|(?:Apr(?:il)?)|May|(?:Jun(?:e)?)|(?:Jul(?:y)?)|(?:Aug(?:ust)?)|(?:Sep(?:tember)?)|(?:Oct(?:ober)?)|(?:Nov(?:ember)?)|(?:Dec(?:ember)?)",
            C: "\\d\\d",
            d: "0[1-9]|[1-9](?!\\d)|1\\d|2\\d|30|31",
            H: "\\d(?!\\d)|[0,1]\\d|20|21|22|23",
            I: "\\d(?!\\d)|0\\d|10|11|12",
            j: "00[1-9]|0?[1-9](?!\\d)|0?[1-9]\\d(?!\\d)|[1,2]\\d\\d|3[0-6]\\d",
            m: "0[1-9]|[1-9](?!\\d)|10|11|12",
            M: "0\\d|\\d(?!\\d)|[1-5]\\d",
            n: " ",
            p: "AM|am|PM|pm|A\\.M\\.|a\\.m\\.|P\\.M\\.|p\\.m\\.",
            S: "0\\d|\\d(?!\\d)|[1-5]\\d|60",
            U: "0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53",
            W: "0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53",
            w: "[0-6]",
            y: "\\d\\d",
            Y: "\\d\\d\\d\\d",
            t: " ",
            z: "Z|(?:[\\+\\-]\\d\\d:?(?:\\d\\d)?)"
          };
          var u = {
            JAN: 0,
            FEB: 1,
            MAR: 2,
            APR: 3,
            MAY: 4,
            JUN: 5,
            JUL: 6,
            AUG: 7,
            SEP: 8,
            OCT: 9,
            NOV: 10,
            DEC: 11
          };
          var m = {
            SUN: 0,
            MON: 1,
            TUE: 2,
            WED: 3,
            THU: 4,
            FRI: 5,
            SAT: 6
          };
          var f = {
            MON: 0,
            TUE: 1,
            WED: 2,
            THU: 3,
            FRI: 4,
            SAT: 5,
            SUN: 6
          };
          var v = [];
          var g = n.replace(/%(.)/g, ($, O) => c[O] || $).replace(/%(.)/g, ($, O) => {
            let J = _[O];
            if (J) {
              v.push(O);
              return `(${J})`;
            } else {
              return O;
            }
          }).replace(/\s+/g, "\\s*");
          var h = new RegExp("^" + g, "i").exec(UTF8ToString(e));
          function p() {
            function $(O, J, B) {
              if (typeof O != "number" || isNaN(O)) {
                return J;
              } else if (O >= J) {
                if (O <= B) {
                  return O;
                } else {
                  return B;
                }
              } else {
                return J;
              }
            }
            return {
              year: $(HEAP32[t + 20 >> 2] + 1900, 1970, 9999),
              month: $(HEAP32[t + 16 >> 2], 0, 11),
              day: $(HEAP32[t + 12 >> 2], 1, 31),
              hour: $(HEAP32[t + 8 >> 2], 0, 23),
              min: $(HEAP32[t + 4 >> 2], 0, 59),
              sec: $(HEAP32[t >> 2], 0, 59),
              gmtoff: 0
            };
          }
          if (h) {
            var b = p();
            var S;
            var w = $ => {
              var O = v.indexOf($);
              if (O >= 0) {
                return h[O + 1];
              }
            };
            if (S = w("S")) {
              b.sec = Number(S);
            }
            if (S = w("M")) {
              b.min = Number(S);
            }
            if (S = w("H")) {
              b.hour = Number(S);
            } else if (S = w("I")) {
              var A = Number(S);
              if (S = w("p")) {
                A += S.toUpperCase()[0] === "P" ? 12 : 0;
              }
              b.hour = A;
            }
            if (S = w("Y")) {
              b.year = Number(S);
            } else if (S = w("y")) {
              var k = Number(S);
              if (S = w("C")) {
                k += Number(S) * 100;
              } else {
                k += k < 69 ? 2000 : 1900;
              }
              b.year = k;
            }
            if (S = w("m")) {
              b.month = Number(S) - 1;
            } else if (S = w("b")) {
              b.month = u[S.substring(0, 3).toUpperCase()] || 0;
            }
            if (S = w("d")) {
              b.day = Number(S);
            } else if (S = w("j")) {
              var G = Number(S);
              var D = isLeapYear(b.year);
              for (var F = 0; F < 12; ++F) {
                var H = arraySum(D ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, F - 1);
                if (G <= H + (D ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[F]) {
                  b.day = G - H;
                }
              }
            } else if (S = w("a")) {
              var z = S.substring(0, 3).toUpperCase();
              if (S = w("U")) {
                var x = m[z];
                var I = Number(S);
                var E = new Date(b.year, 0, 1);
                var M;
                if (E.getDay() === 0) {
                  M = addDays(E, x + (I - 1) * 7);
                } else {
                  M = addDays(E, 7 - E.getDay() + x + (I - 1) * 7);
                }
                b.day = M.getDate();
                b.month = M.getMonth();
              } else if (S = w("W")) {
                var x = f[z];
                var I = Number(S);
                var E = new Date(b.year, 0, 1);
                var M;
                if (E.getDay() === 1) {
                  M = addDays(E, x + (I - 1) * 7);
                } else {
                  M = addDays(E, 7 - E.getDay() + 1 + x + (I - 1) * 7);
                }
                b.day = M.getDate();
                b.month = M.getMonth();
              }
            }
            if (S = w("z")) {
              if (S.toLowerCase() === "z") {
                b.gmtoff = 0;
              } else {
                var Z = S.match(/^((?:\-|\+)\d\d):?(\d\d)?/);
                b.gmtoff = Z[1] * 3600;
                if (Z[2]) {
                  b.gmtoff += b.gmtoff > 0 ? Z[2] * 60 : -Z[2] * 60;
                }
              }
            }
            var N = new Date(b.year, b.month, b.day, b.hour, b.min, b.sec, 0);
            HEAP32[t >> 2] = N.getSeconds();
            HEAP32[t + 4 >> 2] = N.getMinutes();
            HEAP32[t + 8 >> 2] = N.getHours();
            HEAP32[t + 12 >> 2] = N.getDate();
            HEAP32[t + 16 >> 2] = N.getMonth();
            HEAP32[t + 20 >> 2] = N.getFullYear() - 1900;
            HEAP32[t + 24 >> 2] = N.getDay();
            HEAP32[t + 28 >> 2] = arraySum(isLeapYear(N.getFullYear()) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, N.getMonth() - 1) + N.getDate() - 1;
            HEAP32[t + 32 >> 2] = 0;
            HEAP32[t + 36 >> 2] = b.gmtoff;
            return e + lengthBytesUTF8(h[0]);
          }
          return 0;
        };
        _strptime.sig = "pppp";
        var _strptime_l = (e, r, t, n) => _strptime(e, r, t);
        _strptime_l.sig = "ppppp";
        function ___syscall_shutdown(e, r) {
          try {
            getSocketFromFD(e);
            return -52;
          } catch (t) {
            if (typeof FS === "undefined" || t.name !== "ErrnoError") {
              throw t;
            }
            return -t.errno;
          }
        }
        ___syscall_shutdown.sig = "iiiiiii";
        var __dlsym_catchup_js = (e, r) => {
          var t = LDSO.loadedLibsByHandle[e];
          var n = t.exports;
          var a = Object.keys(n)[r];
          var o = n[a];
          var l = addFunction(o, o.sig);
          return l;
        };
        __dlsym_catchup_js.sig = "ppi";
        var FS_createPath = (...e) => FS.createPath(...e);
        var FS_createDevice = (...e) => FS.createDevice(...e);
        var FS_readFile = (...e) => FS.readFile(...e);
        var FS_root = (...e) => FS.root(...e);
        var FS_mounts = (...e) => FS.mounts(...e);
        var FS_devices = (...e) => FS.devices(...e);
        var FS_streams = (...e) => FS.streams(...e);
        var FS_nextInode = (...e) => FS.nextInode(...e);
        var FS_nameTable = (...e) => FS.nameTable(...e);
        var FS_currentPath = (...e) => FS.currentPath(...e);
        var FS_initialized = (...e) => FS.initialized(...e);
        var FS_ignorePermissions = (...e) => FS.ignorePermissions(...e);
        var FS_filesystems = (...e) => FS.filesystems(...e);
        var FS_syncFSRequests = (...e) => FS.syncFSRequests(...e);
        var FS_readFiles = (...e) => FS.readFiles(...e);
        var FS_lookupPath = (...e) => FS.lookupPath(...e);
        var FS_getPath = (...e) => FS.getPath(...e);
        var FS_hashName = (...e) => FS.hashName(...e);
        var FS_hashAddNode = (...e) => FS.hashAddNode(...e);
        var FS_hashRemoveNode = (...e) => FS.hashRemoveNode(...e);
        var FS_lookupNode = (...e) => FS.lookupNode(...e);
        var FS_createNode = (...e) => FS.createNode(...e);
        var FS_destroyNode = (...e) => FS.destroyNode(...e);
        var FS_isRoot = (...e) => FS.isRoot(...e);
        var FS_isMountpoint = (...e) => FS.isMountpoint(...e);
        var FS_isFile = (...e) => FS.isFile(...e);
        var FS_isDir = (...e) => FS.isDir(...e);
        var FS_isLink = (...e) => FS.isLink(...e);
        var FS_isChrdev = (...e) => FS.isChrdev(...e);
        var FS_isBlkdev = (...e) => FS.isBlkdev(...e);
        var FS_isFIFO = (...e) => FS.isFIFO(...e);
        var FS_isSocket = (...e) => FS.isSocket(...e);
        var FS_flagsToPermissionString = (...e) => FS.flagsToPermissionString(...e);
        var FS_nodePermissions = (...e) => FS.nodePermissions(...e);
        var FS_mayLookup = (...e) => FS.mayLookup(...e);
        var FS_mayCreate = (...e) => FS.mayCreate(...e);
        var FS_mayDelete = (...e) => FS.mayDelete(...e);
        var FS_mayOpen = (...e) => FS.mayOpen(...e);
        var FS_checkOpExists = (...e) => FS.checkOpExists(...e);
        var FS_nextfd = (...e) => FS.nextfd(...e);
        var FS_getStreamChecked = (...e) => FS.getStreamChecked(...e);
        var FS_getStream = (...e) => FS.getStream(...e);
        var FS_createStream = (...e) => FS.createStream(...e);
        var FS_closeStream = (...e) => FS.closeStream(...e);
        var FS_dupStream = (...e) => FS.dupStream(...e);
        var FS_doSetAttr = (...e) => FS.doSetAttr(...e);
        var FS_chrdev_stream_ops = (...e) => FS.chrdev_stream_ops(...e);
        var FS_major = (...e) => FS.major(...e);
        var FS_minor = (...e) => FS.minor(...e);
        var FS_makedev = (...e) => FS.makedev(...e);
        var FS_registerDevice = (...e) => FS.registerDevice(...e);
        var FS_getDevice = (...e) => FS.getDevice(...e);
        var FS_getMounts = (...e) => FS.getMounts(...e);
        var FS_syncfs = (...e) => FS.syncfs(...e);
        var FS_mount = (...e) => FS.mount(...e);
        var FS_unmount = (...e) => FS.unmount(...e);
        var FS_lookup = (...e) => FS.lookup(...e);
        var FS_mknod = (...e) => FS.mknod(...e);
        var FS_statfs = (...e) => FS.statfs(...e);
        var FS_statfsStream = (...e) => FS.statfsStream(...e);
        var FS_statfsNode = (...e) => FS.statfsNode(...e);
        var FS_create = (...e) => FS.create(...e);
        var FS_mkdir = (...e) => FS.mkdir(...e);
        var FS_mkdev = (...e) => FS.mkdev(...e);
        var FS_symlink = (...e) => FS.symlink(...e);
        var FS_rename = (...e) => FS.rename(...e);
        var FS_rmdir = (...e) => FS.rmdir(...e);
        var FS_readdir = (...e) => FS.readdir(...e);
        var FS_readlink = (...e) => FS.readlink(...e);
        var FS_stat = (...e) => FS.stat(...e);
        var FS_fstat = (...e) => FS.fstat(...e);
        var FS_lstat = (...e) => FS.lstat(...e);
        var FS_doChmod = (...e) => FS.doChmod(...e);
        var FS_chmod = (...e) => FS.chmod(...e);
        var FS_lchmod = (...e) => FS.lchmod(...e);
        var FS_fchmod = (...e) => FS.fchmod(...e);
        var FS_doChown = (...e) => FS.doChown(...e);
        var FS_chown = (...e) => FS.chown(...e);
        var FS_lchown = (...e) => FS.lchown(...e);
        var FS_fchown = (...e) => FS.fchown(...e);
        var FS_doTruncate = (...e) => FS.doTruncate(...e);
        var FS_truncate = (...e) => FS.truncate(...e);
        var FS_ftruncate = (...e) => FS.ftruncate(...e);
        var FS_utime = (...e) => FS.utime(...e);
        var FS_open = (...e) => FS.open(...e);
        var FS_close = (...e) => FS.close(...e);
        var FS_isClosed = (...e) => FS.isClosed(...e);
        var FS_llseek = (...e) => FS.llseek(...e);
        var FS_read = (...e) => FS.read(...e);
        var FS_write = (...e) => FS.write(...e);
        var FS_mmap = (...e) => FS.mmap(...e);
        var FS_msync = (...e) => FS.msync(...e);
        var FS_ioctl = (...e) => FS.ioctl(...e);
        var FS_writeFile = (...e) => FS.writeFile(...e);
        var FS_cwd = (...e) => FS.cwd(...e);
        var FS_chdir = (...e) => FS.chdir(...e);
        var FS_createDefaultDirectories = (...e) => FS.createDefaultDirectories(...e);
        var FS_createDefaultDevices = (...e) => FS.createDefaultDevices(...e);
        var FS_createSpecialDirectories = (...e) => FS.createSpecialDirectories(...e);
        var FS_createStandardStreams = (...e) => FS.createStandardStreams(...e);
        var FS_staticInit = (...e) => FS.staticInit(...e);
        var FS_init = (...e) => FS.init(...e);
        var FS_quit = (...e) => FS.quit(...e);
        var FS_findObject = (...e) => FS.findObject(...e);
        var FS_analyzePath = (...e) => FS.analyzePath(...e);
        var FS_createFile = (...e) => FS.createFile(...e);
        var FS_forceLoadFile = (...e) => FS.forceLoadFile(...e);
        var FS_createLazyFile = (...e) => FS.createLazyFile(...e);
        var _setNetworkCallback = (e, r, t) => {
          function n(a) {
            callUserCallback(() => {
              if (e === "error") {
                withStackSave(() => {
                  var o = stringToUTF8OnStack(a[2]);
                  getWasmTableEntry(t)(a[0], a[1], o, r);
                });
              } else {
                getWasmTableEntry(t)(a, r);
              }
            });
          }
          SOCKFS.on(e, t ? n : null);
        };
        var _emscripten_set_socket_error_callback = (e, r) => _setNetworkCallback("error", e, r);
        _emscripten_set_socket_error_callback.sig = "vpp";
        var _emscripten_set_socket_open_callback = (e, r) => _setNetworkCallback("open", e, r);
        _emscripten_set_socket_open_callback.sig = "vpp";
        var _emscripten_set_socket_listen_callback = (e, r) => _setNetworkCallback("listen", e, r);
        _emscripten_set_socket_listen_callback.sig = "vpp";
        var _emscripten_set_socket_connection_callback = (e, r) => _setNetworkCallback("connection", e, r);
        _emscripten_set_socket_connection_callback.sig = "vpp";
        var _emscripten_set_socket_message_callback = (e, r) => _setNetworkCallback("message", e, r);
        _emscripten_set_socket_message_callback.sig = "vpp";
        var _emscripten_set_socket_close_callback = (e, r) => _setNetworkCallback("close", e, r);
        _emscripten_set_socket_close_callback.sig = "vpp";
        var _eglGetConfigs = (e, r, t, n) => EGL.chooseConfig(e, 0, r, t, n);
        _eglGetConfigs.sig = "ippip";
        var _eglQuerySurface = (e, r, t, n) => {
          if (e != 62000) {
            EGL.setErrorCode(12296);
            return 0;
          }
          if (r != 62006) {
            EGL.setErrorCode(12301);
            return 0;
          }
          if (!n) {
            EGL.setErrorCode(12300);
            return 0;
          }
          EGL.setErrorCode(12288);
          switch (t) {
            case 12328:
              HEAP32[n >> 2] = 62002;
              return 1;
            case 12376:
              return 1;
            case 12375:
              HEAP32[n >> 2] = Browser.getCanvas().width;
              return 1;
            case 12374:
              HEAP32[n >> 2] = Browser.getCanvas().height;
              return 1;
            case 12432:
              HEAP32[n >> 2] = -1;
              return 1;
            case 12433:
              HEAP32[n >> 2] = -1;
              return 1;
            case 12434:
              HEAP32[n >> 2] = -1;
              return 1;
            case 12422:
              HEAP32[n >> 2] = 12420;
              return 1;
            case 12441:
              HEAP32[n >> 2] = 12442;
              return 1;
            case 12435:
              HEAP32[n >> 2] = 12437;
              return 1;
            case 12416:
            case 12417:
            case 12418:
            case 12419:
              return 1;
            default:
              EGL.setErrorCode(12292);
              return 0;
          }
        };
        _eglQuerySurface.sig = "ippip";
        var _eglQueryContext = (e, r, t, n) => {
          if (e != 62000) {
            EGL.setErrorCode(12296);
            return 0;
          }
          if (r != 62004) {
            EGL.setErrorCode(12294);
            return 0;
          }
          if (!n) {
            EGL.setErrorCode(12300);
            return 0;
          }
          EGL.setErrorCode(12288);
          switch (t) {
            case 12328:
              HEAP32[n >> 2] = 62002;
              return 1;
            case 12439:
              HEAP32[n >> 2] = 12448;
              return 1;
            case 12440:
              HEAP32[n >> 2] = EGL.contextAttributes.majorVersion + 1;
              return 1;
            case 12422:
              HEAP32[n >> 2] = 12420;
              return 1;
            default:
              EGL.setErrorCode(12292);
              return 0;
          }
        };
        _eglQueryContext.sig = "ippip";
        var _eglQueryAPI = () => {
          EGL.setErrorCode(12288);
          return 12448;
        };
        _eglQueryAPI.sig = "i";
        var _eglGetCurrentContext = () => EGL.currentContext;
        _eglGetCurrentContext.sig = "p";
        var _eglGetCurrentSurface = e => e == 12378 ? EGL.currentReadSurface : e == 12377 ? EGL.currentDrawSurface : (EGL.setErrorCode(12300), 0);
        _eglGetCurrentSurface.sig = "pi";
        var _eglGetCurrentDisplay = () => EGL.currentContext ? 62000 : 0;
        _eglGetCurrentDisplay.sig = "p";
        var _eglReleaseThread = () => {
          EGL.currentContext = 0;
          EGL.currentReadSurface = 0;
          EGL.currentDrawSurface = 0;
          EGL.setErrorCode(12288);
          return 1;
        };
        _eglReleaseThread.sig = "i";
        var miniTempWebGLFloatBuffers = [];
        var miniTempWebGLIntBuffers = [];
        var _emscripten_webgl_enable_WEBGL_multi_draw = e => webgl_enable_WEBGL_multi_draw(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_WEBGL_multi_draw.sig = "ip";
        var _emscripten_webgl_enable_EXT_polygon_offset_clamp = e => webgl_enable_EXT_polygon_offset_clamp(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_EXT_polygon_offset_clamp.sig = "ip";
        var _emscripten_webgl_enable_EXT_clip_control = e => webgl_enable_EXT_clip_control(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_EXT_clip_control.sig = "ip";
        var _emscripten_webgl_enable_WEBGL_polygon_mode = e => webgl_enable_WEBGL_polygon_mode(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_WEBGL_polygon_mode.sig = "ip";
        var _glPixelStorei = _emscripten_glPixelStorei;
        _glPixelStorei.sig = "vii";
        var _glGetString = _emscripten_glGetString;
        _glGetString.sig = "pi";
        var _glGetIntegerv = _emscripten_glGetIntegerv;
        _glGetIntegerv.sig = "vip";
        var _glGetFloatv = _emscripten_glGetFloatv;
        _glGetFloatv.sig = "vip";
        var _glGetBooleanv = _emscripten_glGetBooleanv;
        _glGetBooleanv.sig = "vip";
        var _glDeleteTextures = _emscripten_glDeleteTextures;
        _glDeleteTextures.sig = "vip";
        var _glCompressedTexImage2D = _emscripten_glCompressedTexImage2D;
        _glCompressedTexImage2D.sig = "viiiiiiip";
        var _glCompressedTexSubImage2D = _emscripten_glCompressedTexSubImage2D;
        _glCompressedTexSubImage2D.sig = "viiiiiiiip";
        var _glTexImage2D = _emscripten_glTexImage2D;
        _glTexImage2D.sig = "viiiiiiiip";
        var _glTexSubImage2D = _emscripten_glTexSubImage2D;
        _glTexSubImage2D.sig = "viiiiiiiip";
        var _glReadPixels = _emscripten_glReadPixels;
        _glReadPixels.sig = "viiiiiip";
        var _glBindTexture = _emscripten_glBindTexture;
        _glBindTexture.sig = "vii";
        var _glGetTexParameterfv = _emscripten_glGetTexParameterfv;
        _glGetTexParameterfv.sig = "viip";
        var _glGetTexParameteriv = _emscripten_glGetTexParameteriv;
        _glGetTexParameteriv.sig = "viip";
        var _glTexParameterfv = _emscripten_glTexParameterfv;
        _glTexParameterfv.sig = "viip";
        var _glTexParameteriv = _emscripten_glTexParameteriv;
        _glTexParameteriv.sig = "viip";
        var _glIsTexture = _emscripten_glIsTexture;
        _glIsTexture.sig = "ii";
        var _glGenBuffers = _emscripten_glGenBuffers;
        _glGenBuffers.sig = "vip";
        var _glGenTextures = _emscripten_glGenTextures;
        _glGenTextures.sig = "vip";
        var _glDeleteBuffers = _emscripten_glDeleteBuffers;
        _glDeleteBuffers.sig = "vip";
        var _glGetBufferParameteriv = _emscripten_glGetBufferParameteriv;
        _glGetBufferParameteriv.sig = "viip";
        var _glBufferData = _emscripten_glBufferData;
        _glBufferData.sig = "vippi";
        var _glBufferSubData = _emscripten_glBufferSubData;
        _glBufferSubData.sig = "vippp";
        var _glGenQueriesEXT = _emscripten_glGenQueriesEXT;
        var _glDeleteQueriesEXT = _emscripten_glDeleteQueriesEXT;
        var _glIsQueryEXT = _emscripten_glIsQueryEXT;
        var _glBeginQueryEXT = _emscripten_glBeginQueryEXT;
        var _glEndQueryEXT = _emscripten_glEndQueryEXT;
        var _glQueryCounterEXT = _emscripten_glQueryCounterEXT;
        var _glGetQueryivEXT = _emscripten_glGetQueryivEXT;
        var _glGetQueryObjectuivEXT = _emscripten_glGetQueryObjectuivEXT;
        var _glGetQueryObjectui64vEXT = _emscripten_glGetQueryObjectui64vEXT;
        var _glIsBuffer = _emscripten_glIsBuffer;
        _glIsBuffer.sig = "ii";
        var _glGenRenderbuffers = _emscripten_glGenRenderbuffers;
        _glGenRenderbuffers.sig = "vip";
        var _glDeleteRenderbuffers = _emscripten_glDeleteRenderbuffers;
        _glDeleteRenderbuffers.sig = "vip";
        var _glBindRenderbuffer = _emscripten_glBindRenderbuffer;
        _glBindRenderbuffer.sig = "vii";
        var _glGetRenderbufferParameteriv = _emscripten_glGetRenderbufferParameteriv;
        _glGetRenderbufferParameteriv.sig = "viip";
        var _glIsRenderbuffer = _emscripten_glIsRenderbuffer;
        _glIsRenderbuffer.sig = "ii";
        var _glGetUniformfv = _emscripten_glGetUniformfv;
        _glGetUniformfv.sig = "viip";
        var _glGetUniformiv = _emscripten_glGetUniformiv;
        _glGetUniformiv.sig = "viip";
        var _glGetUniformLocation = _emscripten_glGetUniformLocation;
        _glGetUniformLocation.sig = "iip";
        var _glGetVertexAttribfv = _emscripten_glGetVertexAttribfv;
        _glGetVertexAttribfv.sig = "viip";
        var _glGetVertexAttribiv = _emscripten_glGetVertexAttribiv;
        _glGetVertexAttribiv.sig = "viip";
        var _glGetVertexAttribPointerv = _emscripten_glGetVertexAttribPointerv;
        _glGetVertexAttribPointerv.sig = "viip";
        var _glUniform1f = _emscripten_glUniform1f;
        _glUniform1f.sig = "vif";
        var _glUniform2f = _emscripten_glUniform2f;
        _glUniform2f.sig = "viff";
        var _glUniform3f = _emscripten_glUniform3f;
        _glUniform3f.sig = "vifff";
        var _glUniform4f = _emscripten_glUniform4f;
        _glUniform4f.sig = "viffff";
        var _glUniform1i = _emscripten_glUniform1i;
        _glUniform1i.sig = "vii";
        var _glUniform2i = _emscripten_glUniform2i;
        _glUniform2i.sig = "viii";
        var _glUniform3i = _emscripten_glUniform3i;
        _glUniform3i.sig = "viiii";
        var _glUniform4i = _emscripten_glUniform4i;
        _glUniform4i.sig = "viiiii";
        var _glUniform1iv = _emscripten_glUniform1iv;
        _glUniform1iv.sig = "viip";
        var _glUniform2iv = _emscripten_glUniform2iv;
        _glUniform2iv.sig = "viip";
        var _glUniform3iv = _emscripten_glUniform3iv;
        _glUniform3iv.sig = "viip";
        var _glUniform4iv = _emscripten_glUniform4iv;
        _glUniform4iv.sig = "viip";
        var _glUniform1fv = _emscripten_glUniform1fv;
        _glUniform1fv.sig = "viip";
        var _glUniform2fv = _emscripten_glUniform2fv;
        _glUniform2fv.sig = "viip";
        var _glUniform3fv = _emscripten_glUniform3fv;
        _glUniform3fv.sig = "viip";
        var _glUniform4fv = _emscripten_glUniform4fv;
        _glUniform4fv.sig = "viip";
        var _glUniformMatrix2fv = _emscripten_glUniformMatrix2fv;
        _glUniformMatrix2fv.sig = "viiip";
        var _glUniformMatrix3fv = _emscripten_glUniformMatrix3fv;
        _glUniformMatrix3fv.sig = "viiip";
        var _glUniformMatrix4fv = _emscripten_glUniformMatrix4fv;
        _glUniformMatrix4fv.sig = "viiip";
        var _glBindBuffer = _emscripten_glBindBuffer;
        _glBindBuffer.sig = "vii";
        var _glVertexAttrib1fv = _emscripten_glVertexAttrib1fv;
        _glVertexAttrib1fv.sig = "vip";
        var _glVertexAttrib2fv = _emscripten_glVertexAttrib2fv;
        _glVertexAttrib2fv.sig = "vip";
        var _glVertexAttrib3fv = _emscripten_glVertexAttrib3fv;
        _glVertexAttrib3fv.sig = "vip";
        var _glVertexAttrib4fv = _emscripten_glVertexAttrib4fv;
        _glVertexAttrib4fv.sig = "vip";
        var _glGetAttribLocation = _emscripten_glGetAttribLocation;
        _glGetAttribLocation.sig = "iip";
        var _glGetActiveAttrib = _emscripten_glGetActiveAttrib;
        _glGetActiveAttrib.sig = "viiipppp";
        var _glGetActiveUniform = _emscripten_glGetActiveUniform;
        _glGetActiveUniform.sig = "viiipppp";
        var _glCreateShader = _emscripten_glCreateShader;
        _glCreateShader.sig = "ii";
        var _glDeleteShader = _emscripten_glDeleteShader;
        _glDeleteShader.sig = "vi";
        var _glGetAttachedShaders = _emscripten_glGetAttachedShaders;
        _glGetAttachedShaders.sig = "viipp";
        var _glShaderSource = _emscripten_glShaderSource;
        _glShaderSource.sig = "viipp";
        var _glGetShaderSource = _emscripten_glGetShaderSource;
        _glGetShaderSource.sig = "viipp";
        var _glCompileShader = _emscripten_glCompileShader;
        _glCompileShader.sig = "vi";
        var _glGetShaderInfoLog = _emscripten_glGetShaderInfoLog;
        _glGetShaderInfoLog.sig = "viipp";
        var _glGetShaderiv = _emscripten_glGetShaderiv;
        _glGetShaderiv.sig = "viip";
        var _glGetProgramiv = _emscripten_glGetProgramiv;
        _glGetProgramiv.sig = "viip";
        var _glIsShader = _emscripten_glIsShader;
        _glIsShader.sig = "ii";
        var _glCreateProgram = _emscripten_glCreateProgram;
        _glCreateProgram.sig = "i";
        var _glDeleteProgram = _emscripten_glDeleteProgram;
        _glDeleteProgram.sig = "vi";
        var _glAttachShader = _emscripten_glAttachShader;
        _glAttachShader.sig = "vii";
        var _glDetachShader = _emscripten_glDetachShader;
        _glDetachShader.sig = "vii";
        var _glGetShaderPrecisionFormat = _emscripten_glGetShaderPrecisionFormat;
        _glGetShaderPrecisionFormat.sig = "viipp";
        var _glLinkProgram = _emscripten_glLinkProgram;
        _glLinkProgram.sig = "vi";
        var _glGetProgramInfoLog = _emscripten_glGetProgramInfoLog;
        _glGetProgramInfoLog.sig = "viipp";
        var _glUseProgram = _emscripten_glUseProgram;
        _glUseProgram.sig = "vi";
        var _glValidateProgram = _emscripten_glValidateProgram;
        _glValidateProgram.sig = "vi";
        var _glIsProgram = _emscripten_glIsProgram;
        _glIsProgram.sig = "ii";
        var _glBindAttribLocation = _emscripten_glBindAttribLocation;
        _glBindAttribLocation.sig = "viip";
        var _glBindFramebuffer = _emscripten_glBindFramebuffer;
        _glBindFramebuffer.sig = "vii";
        var _glGenFramebuffers = _emscripten_glGenFramebuffers;
        _glGenFramebuffers.sig = "vip";
        var _glDeleteFramebuffers = _emscripten_glDeleteFramebuffers;
        _glDeleteFramebuffers.sig = "vip";
        var _glFramebufferRenderbuffer = _emscripten_glFramebufferRenderbuffer;
        _glFramebufferRenderbuffer.sig = "viiii";
        var _glFramebufferTexture2D = _emscripten_glFramebufferTexture2D;
        _glFramebufferTexture2D.sig = "viiiii";
        var _glGetFramebufferAttachmentParameteriv = _emscripten_glGetFramebufferAttachmentParameteriv;
        _glGetFramebufferAttachmentParameteriv.sig = "viiip";
        var _glIsFramebuffer = _emscripten_glIsFramebuffer;
        _glIsFramebuffer.sig = "ii";
        var _emscripten_glVertexPointer = (e, r, t, n) => abort("Legacy GL function (glVertexPointer) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.");
        _emscripten_glVertexPointer.sig = "viiip";
        var _glVertexPointer = _emscripten_glVertexPointer;
        _glVertexPointer.sig = "viiip";
        var _emscripten_glMatrixMode = () => abort("Legacy GL function (glMatrixMode) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.");
        _emscripten_glMatrixMode.sig = "vi";
        var _glMatrixMode = _emscripten_glMatrixMode;
        _glMatrixMode.sig = "vi";
        var _emscripten_glBegin = () => abort("Legacy GL function (glBegin) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.");
        _emscripten_glBegin.sig = "vi";
        var _glBegin = _emscripten_glBegin;
        _glBegin.sig = "vi";
        var _emscripten_glLoadIdentity = () => abort("Legacy GL function (glLoadIdentity) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.");
        _emscripten_glLoadIdentity.sig = "v";
        var _glLoadIdentity = _emscripten_glLoadIdentity;
        _glLoadIdentity.sig = "v";
        var _glGenVertexArraysOES = _emscripten_glGenVertexArraysOES;
        _glGenVertexArraysOES.sig = "vip";
        var _glDeleteVertexArraysOES = _emscripten_glDeleteVertexArraysOES;
        _glDeleteVertexArraysOES.sig = "vip";
        var _glBindVertexArrayOES = _emscripten_glBindVertexArrayOES;
        _glBindVertexArrayOES.sig = "vi";
        var _glIsVertexArrayOES = _emscripten_glIsVertexArrayOES;
        _glIsVertexArrayOES.sig = "ii";
        var _glVertexAttribPointer = _emscripten_glVertexAttribPointer;
        _glVertexAttribPointer.sig = "viiiiip";
        var _glEnableVertexAttribArray = _emscripten_glEnableVertexAttribArray;
        _glEnableVertexAttribArray.sig = "vi";
        var _glDisableVertexAttribArray = _emscripten_glDisableVertexAttribArray;
        _glDisableVertexAttribArray.sig = "vi";
        var _glDrawArrays = _emscripten_glDrawArrays;
        _glDrawArrays.sig = "viii";
        var _glShaderBinary = _emscripten_glShaderBinary;
        _glShaderBinary.sig = "vipipi";
        var _glReleaseShaderCompiler = _emscripten_glReleaseShaderCompiler;
        _glReleaseShaderCompiler.sig = "v";
        var _glGetError = _emscripten_glGetError;
        _glGetError.sig = "i";
        var _glVertexAttribDivisorNV = _emscripten_glVertexAttribDivisorNV;
        var _glDrawArraysInstancedNV = _emscripten_glDrawArraysInstancedNV;
        var _glDrawElementsInstancedNV = _emscripten_glDrawElementsInstancedNV;
        var _glVertexAttribDivisorEXT = _emscripten_glVertexAttribDivisorEXT;
        var _glDrawArraysInstancedEXT = _emscripten_glDrawArraysInstancedEXT;
        var _glDrawElementsInstancedEXT = _emscripten_glDrawElementsInstancedEXT;
        var _glVertexAttribDivisorARB = _emscripten_glVertexAttribDivisorARB;
        var _glDrawArraysInstancedARB = _emscripten_glDrawArraysInstancedARB;
        var _glDrawElementsInstancedARB = _emscripten_glDrawElementsInstancedARB;
        var _glVertexAttribDivisorANGLE = _emscripten_glVertexAttribDivisorANGLE;
        var _glDrawArraysInstancedANGLE = _emscripten_glDrawArraysInstancedANGLE;
        var _glDrawElementsInstancedANGLE = _emscripten_glDrawElementsInstancedANGLE;
        var _glDrawBuffersEXT = _emscripten_glDrawBuffersEXT;
        var _glDrawBuffersWEBGL = _emscripten_glDrawBuffersWEBGL;
        var _glColorMask = _emscripten_glColorMask;
        _glColorMask.sig = "viiii";
        var _glDepthMask = _emscripten_glDepthMask;
        _glDepthMask.sig = "vi";
        var _glSampleCoverage = _emscripten_glSampleCoverage;
        _glSampleCoverage.sig = "vfi";
        var _emscripten_glMultiDrawArraysWEBGL = (e, r, t, n) => {
          GLctx.multiDrawWebgl.multiDrawArraysWEBGL(e, HEAP32, r >> 2, HEAP32, t >> 2, n);
        };
        _emscripten_glMultiDrawArraysWEBGL.sig = "vippi";
        var _glMultiDrawArraysWEBGL = _emscripten_glMultiDrawArraysWEBGL;
        var _emscripten_glMultiDrawArrays = _glMultiDrawArraysWEBGL;
        _emscripten_glMultiDrawArrays.sig = "vippi";
        var _glMultiDrawArrays = _emscripten_glMultiDrawArrays;
        _glMultiDrawArrays.sig = "vippi";
        var _emscripten_glMultiDrawArraysANGLE = _glMultiDrawArraysWEBGL;
        var _glMultiDrawArraysANGLE = _emscripten_glMultiDrawArraysANGLE;
        var _emscripten_glMultiDrawArraysInstancedWEBGL = (e, r, t, n, a) => {
          GLctx.multiDrawWebgl.multiDrawArraysInstancedWEBGL(e, HEAP32, r >> 2, HEAP32, t >> 2, HEAP32, n >> 2, a);
        };
        _emscripten_glMultiDrawArraysInstancedWEBGL.sig = "vipppi";
        var _glMultiDrawArraysInstancedWEBGL = _emscripten_glMultiDrawArraysInstancedWEBGL;
        var _emscripten_glMultiDrawArraysInstancedANGLE = _glMultiDrawArraysInstancedWEBGL;
        var _glMultiDrawArraysInstancedANGLE = _emscripten_glMultiDrawArraysInstancedANGLE;
        var _emscripten_glMultiDrawElementsWEBGL = (e, r, t, n, a) => {
          GLctx.multiDrawWebgl.multiDrawElementsWEBGL(e, HEAP32, r >> 2, t, HEAP32, n >> 2, a);
        };
        _emscripten_glMultiDrawElementsWEBGL.sig = "vipipi";
        var _glMultiDrawElementsWEBGL = _emscripten_glMultiDrawElementsWEBGL;
        var _emscripten_glMultiDrawElements = _glMultiDrawElementsWEBGL;
        _emscripten_glMultiDrawElements.sig = "vipipi";
        var _glMultiDrawElements = _emscripten_glMultiDrawElements;
        _glMultiDrawElements.sig = "vipipi";
        var _emscripten_glMultiDrawElementsANGLE = _glMultiDrawElementsWEBGL;
        var _glMultiDrawElementsANGLE = _emscripten_glMultiDrawElementsANGLE;
        var _emscripten_glMultiDrawElementsInstancedWEBGL = (e, r, t, n, a, o) => {
          GLctx.multiDrawWebgl.multiDrawElementsInstancedWEBGL(e, HEAP32, r >> 2, t, HEAP32, n >> 2, HEAP32, a >> 2, o);
        };
        _emscripten_glMultiDrawElementsInstancedWEBGL.sig = "vipippi";
        var _glMultiDrawElementsInstancedWEBGL = _emscripten_glMultiDrawElementsInstancedWEBGL;
        var _emscripten_glMultiDrawElementsInstancedANGLE = _glMultiDrawElementsInstancedWEBGL;
        var _glMultiDrawElementsInstancedANGLE = _emscripten_glMultiDrawElementsInstancedANGLE;
        var _glPolygonOffsetClampEXT = _emscripten_glPolygonOffsetClampEXT;
        var _glClipControlEXT = _emscripten_glClipControlEXT;
        var _glPolygonModeWEBGL = _emscripten_glPolygonModeWEBGL;
        var _glFinish = _emscripten_glFinish;
        _glFinish.sig = "v";
        var _glFlush = _emscripten_glFlush;
        _glFlush.sig = "v";
        var _emscripten_glClearDepth = e => GLctx.clearDepth(e);
        _emscripten_glClearDepth.sig = "vd";
        var _glClearDepth = _emscripten_glClearDepth;
        _glClearDepth.sig = "vd";
        var _glClearDepthf = _emscripten_glClearDepthf;
        _glClearDepthf.sig = "vf";
        var _glDepthFunc = _emscripten_glDepthFunc;
        _glDepthFunc.sig = "vi";
        var _glEnable = _emscripten_glEnable;
        _glEnable.sig = "vi";
        var _glDisable = _emscripten_glDisable;
        _glDisable.sig = "vi";
        var _glFrontFace = _emscripten_glFrontFace;
        _glFrontFace.sig = "vi";
        var _glCullFace = _emscripten_glCullFace;
        _glCullFace.sig = "vi";
        var _glClear = _emscripten_glClear;
        _glClear.sig = "vi";
        var _glLineWidth = _emscripten_glLineWidth;
        _glLineWidth.sig = "vf";
        var _glClearStencil = _emscripten_glClearStencil;
        _glClearStencil.sig = "vi";
        var _glStencilMask = _emscripten_glStencilMask;
        _glStencilMask.sig = "vi";
        var _glCheckFramebufferStatus = _emscripten_glCheckFramebufferStatus;
        _glCheckFramebufferStatus.sig = "ii";
        var _glGenerateMipmap = _emscripten_glGenerateMipmap;
        _glGenerateMipmap.sig = "vi";
        var _glActiveTexture = _emscripten_glActiveTexture;
        _glActiveTexture.sig = "vi";
        var _glBlendEquation = _emscripten_glBlendEquation;
        _glBlendEquation.sig = "vi";
        var _glIsEnabled = _emscripten_glIsEnabled;
        _glIsEnabled.sig = "ii";
        var _glBlendFunc = _emscripten_glBlendFunc;
        _glBlendFunc.sig = "vii";
        var _glBlendEquationSeparate = _emscripten_glBlendEquationSeparate;
        _glBlendEquationSeparate.sig = "vii";
        var _emscripten_glDepthRange = (e, r) => GLctx.depthRange(e, r);
        _emscripten_glDepthRange.sig = "vdd";
        var _glDepthRange = _emscripten_glDepthRange;
        _glDepthRange.sig = "vdd";
        var _glDepthRangef = _emscripten_glDepthRangef;
        _glDepthRangef.sig = "vff";
        var _glStencilMaskSeparate = _emscripten_glStencilMaskSeparate;
        _glStencilMaskSeparate.sig = "vii";
        var _glHint = _emscripten_glHint;
        _glHint.sig = "vii";
        var _glPolygonOffset = _emscripten_glPolygonOffset;
        _glPolygonOffset.sig = "vff";
        var _glVertexAttrib1f = _emscripten_glVertexAttrib1f;
        _glVertexAttrib1f.sig = "vif";
        var _glTexParameteri = _emscripten_glTexParameteri;
        _glTexParameteri.sig = "viii";
        var _glTexParameterf = _emscripten_glTexParameterf;
        _glTexParameterf.sig = "viif";
        var _glVertexAttrib2f = _emscripten_glVertexAttrib2f;
        _glVertexAttrib2f.sig = "viff";
        var _glStencilFunc = _emscripten_glStencilFunc;
        _glStencilFunc.sig = "viii";
        var _glStencilOp = _emscripten_glStencilOp;
        _glStencilOp.sig = "viii";
        var _glViewport = _emscripten_glViewport;
        _glViewport.sig = "viiii";
        var _glClearColor = _emscripten_glClearColor;
        _glClearColor.sig = "vffff";
        var _glScissor = _emscripten_glScissor;
        _glScissor.sig = "viiii";
        var _glVertexAttrib3f = _emscripten_glVertexAttrib3f;
        _glVertexAttrib3f.sig = "vifff";
        var _glRenderbufferStorage = _emscripten_glRenderbufferStorage;
        _glRenderbufferStorage.sig = "viiii";
        var _glBlendFuncSeparate = _emscripten_glBlendFuncSeparate;
        _glBlendFuncSeparate.sig = "viiii";
        var _glBlendColor = _emscripten_glBlendColor;
        _glBlendColor.sig = "vffff";
        var _glStencilFuncSeparate = _emscripten_glStencilFuncSeparate;
        _glStencilFuncSeparate.sig = "viiii";
        var _glStencilOpSeparate = _emscripten_glStencilOpSeparate;
        _glStencilOpSeparate.sig = "viiii";
        var _glVertexAttrib4f = _emscripten_glVertexAttrib4f;
        _glVertexAttrib4f.sig = "viffff";
        var _glCopyTexImage2D = _emscripten_glCopyTexImage2D;
        _glCopyTexImage2D.sig = "viiiiiiii";
        var _glCopyTexSubImage2D = _emscripten_glCopyTexSubImage2D;
        _glCopyTexSubImage2D.sig = "viiiiiiii";
        var writeGLArray = (e, r, t, n) => {
          var a = e.length;
          var o = t < a ? t : a;
          var l = n ? HEAPF32 : HEAP32;
          r = r >> 2;
          for (var c = 0; c < o; ++c) {
            l[r + c] = e[c];
          }
          return a;
        };
        var webglPowerPreferences = ["default", "low-power", "high-performance"];
        var _emscripten_webgl_do_create_context = (e, r) => {
          var t = r >> 2;
          var n = HEAP32[t + 2];
          var a = {
            alpha: !!HEAP8[r + 0],
            depth: !!HEAP8[r + 1],
            stencil: !!HEAP8[r + 2],
            antialias: !!HEAP8[r + 3],
            premultipliedAlpha: !!HEAP8[r + 4],
            preserveDrawingBuffer: !!HEAP8[r + 5],
            powerPreference: webglPowerPreferences[n],
            failIfMajorPerformanceCaveat: !!HEAP8[r + 12],
            majorVersion: HEAP32[t + 4],
            minorVersion: HEAP32[t + 5],
            enableExtensionsByDefault: HEAP8[r + 24],
            explicitSwapControl: HEAP8[r + 25],
            proxyContextToMainThread: HEAP32[t + 7],
            renderViaOffscreenBackBuffer: HEAP8[r + 32]
          };
          var o = findCanvasEventTarget(e);
          if (!o || a.explicitSwapControl) {
            return 0;
          }
          var l = GL.createContext(o, a);
          return l;
        };
        _emscripten_webgl_do_create_context.sig = "ppp";
        var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;
        _emscripten_webgl_create_context.sig = "ppp";
        var _emscripten_webgl_do_get_current_context = () => GL.currentContext ? GL.currentContext.handle : 0;
        _emscripten_webgl_do_get_current_context.sig = "p";
        var _emscripten_webgl_get_current_context = _emscripten_webgl_do_get_current_context;
        _emscripten_webgl_get_current_context.sig = "p";
        var _emscripten_webgl_do_commit_frame = () => !GL.currentContext || !GL.currentContext.GLctx || !GL.currentContext.attributes.explicitSwapControl ? -3 : 0;
        _emscripten_webgl_do_commit_frame.sig = "i";
        var _emscripten_webgl_commit_frame = _emscripten_webgl_do_commit_frame;
        _emscripten_webgl_commit_frame.sig = "i";
        var _emscripten_webgl_make_context_current = e => {
          var r = GL.makeContextCurrent(e);
          if (r) {
            return 0;
          } else {
            return -5;
          }
        };
        _emscripten_webgl_make_context_current.sig = "ip";
        var _emscripten_webgl_get_drawing_buffer_size = (e, r, t) => {
          var n = GL.getContext(e);
          if (!n || !n.GLctx || !r || !t) {
            return -5;
          } else {
            HEAP32[r >> 2] = n.GLctx.drawingBufferWidth;
            HEAP32[t >> 2] = n.GLctx.drawingBufferHeight;
            return 0;
          }
        };
        _emscripten_webgl_get_drawing_buffer_size.sig = "ippp";
        var _emscripten_webgl_get_context_attributes = (e, r) => {
          if (!r) {
            return -5;
          }
          e = GL.contexts[e];
          if (!e) {
            return -3;
          }
          var t = e.GLctx?.getContextAttributes();
          if (!t) {
            return -3;
          }
          HEAP8[r] = t.alpha;
          HEAP8[r + 1] = t.depth;
          HEAP8[r + 2] = t.stencil;
          HEAP8[r + 3] = t.antialias;
          HEAP8[r + 4] = t.premultipliedAlpha;
          HEAP8[r + 5] = t.preserveDrawingBuffer;
          var n = t.powerPreference && webglPowerPreferences.indexOf(t.powerPreference);
          HEAP32[r + 8 >> 2] = n;
          HEAP8[r + 12] = t.failIfMajorPerformanceCaveat;
          HEAP32[r + 16 >> 2] = e.version;
          HEAP32[r + 20 >> 2] = 0;
          HEAP8[r + 24] = e.attributes.enableExtensionsByDefault;
          return 0;
        };
        _emscripten_webgl_get_context_attributes.sig = "ipp";
        var _emscripten_webgl_destroy_context = e => {
          if (GL.currentContext == e) {
            GL.currentContext = 0;
          }
          GL.deleteContext(e);
        };
        _emscripten_webgl_destroy_context.sig = "ip";
        var _emscripten_webgl_enable_extension = (e, r) => {
          var t = GL.getContext(e);
          var n = UTF8ToString(r);
          if (n.startsWith("GL_")) {
            n = n.slice(3);
          }
          if (n == "WEBGL_draw_instanced_base_vertex_base_instance") {
            webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
          }
          if (n == "WEBGL_multi_draw_instanced_base_vertex_base_instance") {
            webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
          }
          if (n == "WEBGL_multi_draw") {
            webgl_enable_WEBGL_multi_draw(GLctx);
          }
          if (n == "EXT_polygon_offset_clamp") {
            webgl_enable_EXT_polygon_offset_clamp(GLctx);
          }
          if (n == "EXT_clip_control") {
            webgl_enable_EXT_clip_control(GLctx);
          }
          if (n == "WEBGL_polygon_mode") {
            webgl_enable_WEBGL_polygon_mode(GLctx);
          }
          var a = t.GLctx.getExtension(n);
          return !!a;
        };
        _emscripten_webgl_enable_extension.sig = "ipp";
        var _emscripten_supports_offscreencanvas = () => 0;
        _emscripten_supports_offscreencanvas.sig = "i";
        var registerWebGlEventCallback = (e, r, t, n, a, o, l) => {
          var c = u => {
            if (getWasmTableEntry(n)(a, 0, r)) {
              u.preventDefault();
            }
          };
          var _ = {
            target: findEventTarget(e),
            eventTypeString: o,
            eventTypeId: a,
            userData: r,
            callbackfunc: n,
            handlerFunc: c,
            useCapture: t
          };
          JSEvents.registerOrRemoveHandler(_);
        };
        var _emscripten_set_webglcontextlost_callback_on_thread = (e, r, t, n, a) => {
          registerWebGlEventCallback(e, r, t, n, 31, "webglcontextlost", a);
          return 0;
        };
        _emscripten_set_webglcontextlost_callback_on_thread.sig = "ippipp";
        var _emscripten_set_webglcontextrestored_callback_on_thread = (e, r, t, n, a) => {
          registerWebGlEventCallback(e, r, t, n, 32, "webglcontextrestored", a);
          return 0;
        };
        _emscripten_set_webglcontextrestored_callback_on_thread.sig = "ippipp";
        var _emscripten_is_webgl_context_lost = e => !GL.contexts[e] || GL.contexts[e].GLctx.isContextLost();
        _emscripten_is_webgl_context_lost.sig = "ip";
        var _emscripten_webgl_get_supported_extensions = () => stringToNewUTF8(GLctx.getSupportedExtensions().join(" "));
        _emscripten_webgl_get_supported_extensions.sig = "p";
        var _emscripten_webgl_get_program_parameter_d = (e, r) => GLctx.getProgramParameter(GL.programs[e], r);
        _emscripten_webgl_get_program_parameter_d.sig = "dii";
        var _emscripten_webgl_get_program_info_log_utf8 = e => stringToNewUTF8(GLctx.getProgramInfoLog(GL.programs[e]));
        _emscripten_webgl_get_program_info_log_utf8.sig = "pi";
        var _emscripten_webgl_get_shader_parameter_d = (e, r) => GLctx.getShaderParameter(GL.shaders[e], r);
        _emscripten_webgl_get_shader_parameter_d.sig = "dii";
        var _emscripten_webgl_get_shader_info_log_utf8 = e => stringToNewUTF8(GLctx.getShaderInfoLog(GL.shaders[e]));
        _emscripten_webgl_get_shader_info_log_utf8.sig = "pi";
        var _emscripten_webgl_get_shader_source_utf8 = e => stringToNewUTF8(GLctx.getShaderSource(GL.shaders[e]));
        _emscripten_webgl_get_shader_source_utf8.sig = "pi";
        var _emscripten_webgl_get_vertex_attrib_d = (e, r) => GLctx.getVertexAttrib(e, r);
        _emscripten_webgl_get_vertex_attrib_d.sig = "dii";
        var _emscripten_webgl_get_vertex_attrib_o = (e, r) => {
          var t = GLctx.getVertexAttrib(e, r);
          return t?.name;
        };
        _emscripten_webgl_get_vertex_attrib_o.sig = "iii";
        var _emscripten_webgl_get_vertex_attrib_v = (e, r, t, n, a) => writeGLArray(GLctx.getVertexAttrib(e, r), t, n, a);
        _emscripten_webgl_get_vertex_attrib_v.sig = "iiipii";
        var _emscripten_webgl_get_uniform_d = (e, r) => GLctx.getUniform(GL.programs[e], webglGetUniformLocation(r));
        _emscripten_webgl_get_uniform_d.sig = "dii";
        var _emscripten_webgl_get_uniform_v = (e, r, t, n, a) => writeGLArray(GLctx.getUniform(GL.programs[e], webglGetUniformLocation(r)), t, n, a);
        _emscripten_webgl_get_uniform_v.sig = "iiipii";
        var _emscripten_webgl_get_parameter_v = (e, r, t, n) => writeGLArray(GLctx.getParameter(e), r, t, n);
        _emscripten_webgl_get_parameter_v.sig = "iipii";
        var _emscripten_webgl_get_parameter_d = e => GLctx.getParameter(e);
        _emscripten_webgl_get_parameter_d.sig = "di";
        var _emscripten_webgl_get_parameter_o = e => {
          var r = GLctx.getParameter(e);
          return r?.name;
        };
        _emscripten_webgl_get_parameter_o.sig = "ii";
        var _emscripten_webgl_get_parameter_utf8 = e => stringToNewUTF8(GLctx.getParameter(e));
        _emscripten_webgl_get_parameter_utf8.sig = "pi";
        var _emscripten_webgl_get_parameter_i64v = (e, r) => writeI53ToI64(r, GLctx.getParameter(e));
        _emscripten_webgl_get_parameter_i64v.sig = "vip";
        var _emscripten_webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = e => webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance.sig = "ip";
        var _emscripten_webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = e => webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GL.contexts[e].GLctx);
        _emscripten_webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance.sig = "ip";
        var _glGetStringi = _emscripten_glGetStringi;
        _glGetStringi.sig = "pii";
        var _glGetInteger64v = _emscripten_glGetInteger64v;
        _glGetInteger64v.sig = "vip";
        var _glGetInternalformativ = _emscripten_glGetInternalformativ;
        _glGetInternalformativ.sig = "viiiip";
        var _glCompressedTexImage3D = _emscripten_glCompressedTexImage3D;
        _glCompressedTexImage3D.sig = "viiiiiiiip";
        var _glCompressedTexSubImage3D = _emscripten_glCompressedTexSubImage3D;
        _glCompressedTexSubImage3D.sig = "viiiiiiiiiip";
        var _glGetBufferParameteri64v = _emscripten_glGetBufferParameteri64v;
        _glGetBufferParameteri64v.sig = "viip";
        var _emscripten_glGetBufferSubData = (e, r, t, n) => {
          if (!n) {
            GL.recordError(1281);
            return;
          }
          if (t) {
            GLctx.getBufferSubData(e, r, HEAPU8, n, t);
          }
        };
        _emscripten_glGetBufferSubData.sig = "vippp";
        var _glGetBufferSubData = _emscripten_glGetBufferSubData;
        _glGetBufferSubData.sig = "vippp";
        var _glInvalidateFramebuffer = _emscripten_glInvalidateFramebuffer;
        _glInvalidateFramebuffer.sig = "viip";
        var _glInvalidateSubFramebuffer = _emscripten_glInvalidateSubFramebuffer;
        _glInvalidateSubFramebuffer.sig = "viipiiii";
        var _glTexImage3D = _emscripten_glTexImage3D;
        _glTexImage3D.sig = "viiiiiiiiip";
        var _glTexSubImage3D = _emscripten_glTexSubImage3D;
        _glTexSubImage3D.sig = "viiiiiiiiiip";
        var _glGenQueries = _emscripten_glGenQueries;
        _glGenQueries.sig = "vip";
        var _glDeleteQueries = _emscripten_glDeleteQueries;
        _glDeleteQueries.sig = "vip";
        var _glIsQuery = _emscripten_glIsQuery;
        _glIsQuery.sig = "ii";
        var _glBeginQuery = _emscripten_glBeginQuery;
        _glBeginQuery.sig = "vii";
        var _glGetQueryiv = _emscripten_glGetQueryiv;
        _glGetQueryiv.sig = "viip";
        var _glGetQueryObjectuiv = _emscripten_glGetQueryObjectuiv;
        _glGetQueryObjectuiv.sig = "viip";
        var _glGenSamplers = _emscripten_glGenSamplers;
        _glGenSamplers.sig = "vip";
        var _glDeleteSamplers = _emscripten_glDeleteSamplers;
        _glDeleteSamplers.sig = "vip";
        var _glIsSampler = _emscripten_glIsSampler;
        _glIsSampler.sig = "ii";
        var _glBindSampler = _emscripten_glBindSampler;
        _glBindSampler.sig = "vii";
        var _glSamplerParameterf = _emscripten_glSamplerParameterf;
        _glSamplerParameterf.sig = "viif";
        var _glSamplerParameteri = _emscripten_glSamplerParameteri;
        _glSamplerParameteri.sig = "viii";
        var _glSamplerParameterfv = _emscripten_glSamplerParameterfv;
        _glSamplerParameterfv.sig = "viip";
        var _glSamplerParameteriv = _emscripten_glSamplerParameteriv;
        _glSamplerParameteriv.sig = "viip";
        var _glGetSamplerParameterfv = _emscripten_glGetSamplerParameterfv;
        _glGetSamplerParameterfv.sig = "viip";
        var _glGetSamplerParameteriv = _emscripten_glGetSamplerParameteriv;
        _glGetSamplerParameteriv.sig = "viip";
        var _glGenTransformFeedbacks = _emscripten_glGenTransformFeedbacks;
        _glGenTransformFeedbacks.sig = "vip";
        var _glDeleteTransformFeedbacks = _emscripten_glDeleteTransformFeedbacks;
        _glDeleteTransformFeedbacks.sig = "vip";
        var _glIsTransformFeedback = _emscripten_glIsTransformFeedback;
        _glIsTransformFeedback.sig = "ii";
        var _glBindTransformFeedback = _emscripten_glBindTransformFeedback;
        _glBindTransformFeedback.sig = "vii";
        var _glTransformFeedbackVaryings = _emscripten_glTransformFeedbackVaryings;
        _glTransformFeedbackVaryings.sig = "viipi";
        var _glGetTransformFeedbackVarying = _emscripten_glGetTransformFeedbackVarying;
        _glGetTransformFeedbackVarying.sig = "viiipppp";
        var _glGetIntegeri_v = _emscripten_glGetIntegeri_v;
        _glGetIntegeri_v.sig = "viip";
        var _glGetInteger64i_v = _emscripten_glGetInteger64i_v;
        _glGetInteger64i_v.sig = "viip";
        var _glBindBufferBase = _emscripten_glBindBufferBase;
        _glBindBufferBase.sig = "viii";
        var _glBindBufferRange = _emscripten_glBindBufferRange;
        _glBindBufferRange.sig = "viiipp";
        var _glGetUniformIndices = _emscripten_glGetUniformIndices;
        _glGetUniformIndices.sig = "viipp";
        var _glGetActiveUniformsiv = _emscripten_glGetActiveUniformsiv;
        _glGetActiveUniformsiv.sig = "viipip";
        var _glGetUniformBlockIndex = _emscripten_glGetUniformBlockIndex;
        _glGetUniformBlockIndex.sig = "iip";
        var _glGetActiveUniformBlockiv = _emscripten_glGetActiveUniformBlockiv;
        _glGetActiveUniformBlockiv.sig = "viiip";
        var _glGetActiveUniformBlockName = _emscripten_glGetActiveUniformBlockName;
        _glGetActiveUniformBlockName.sig = "viiipp";
        var _glUniformBlockBinding = _emscripten_glUniformBlockBinding;
        _glUniformBlockBinding.sig = "viii";
        var _glClearBufferiv = _emscripten_glClearBufferiv;
        _glClearBufferiv.sig = "viip";
        var _glClearBufferuiv = _emscripten_glClearBufferuiv;
        _glClearBufferuiv.sig = "viip";
        var _glClearBufferfv = _emscripten_glClearBufferfv;
        _glClearBufferfv.sig = "viip";
        var _glFenceSync = _emscripten_glFenceSync;
        _glFenceSync.sig = "pii";
        var _glDeleteSync = _emscripten_glDeleteSync;
        _glDeleteSync.sig = "vp";
        var _glClientWaitSync = _emscripten_glClientWaitSync;
        _glClientWaitSync.sig = "ipij";
        var _glWaitSync = _emscripten_glWaitSync;
        _glWaitSync.sig = "vpij";
        var _glGetSynciv = _emscripten_glGetSynciv;
        _glGetSynciv.sig = "vpiipp";
        var _glIsSync = _emscripten_glIsSync;
        _glIsSync.sig = "ip";
        var _glGetUniformuiv = _emscripten_glGetUniformuiv;
        _glGetUniformuiv.sig = "viip";
        var _glGetFragDataLocation = _emscripten_glGetFragDataLocation;
        _glGetFragDataLocation.sig = "iip";
        var _glGetVertexAttribIuiv = _emscripten_glGetVertexAttribIuiv;
        _glGetVertexAttribIuiv.sig = "viip";
        var _glUniform1ui = _emscripten_glUniform1ui;
        _glUniform1ui.sig = "vii";
        var _glUniform2ui = _emscripten_glUniform2ui;
        _glUniform2ui.sig = "viii";
        var _glUniform3ui = _emscripten_glUniform3ui;
        _glUniform3ui.sig = "viiii";
        var _glUniform4ui = _emscripten_glUniform4ui;
        _glUniform4ui.sig = "viiiii";
        var _glUniform1uiv = _emscripten_glUniform1uiv;
        _glUniform1uiv.sig = "viip";
        var _glUniform2uiv = _emscripten_glUniform2uiv;
        _glUniform2uiv.sig = "viip";
        var _glUniform3uiv = _emscripten_glUniform3uiv;
        _glUniform3uiv.sig = "viip";
        var _glUniform4uiv = _emscripten_glUniform4uiv;
        _glUniform4uiv.sig = "viip";
        var _glUniformMatrix2x3fv = _emscripten_glUniformMatrix2x3fv;
        _glUniformMatrix2x3fv.sig = "viiip";
        var _glUniformMatrix3x2fv = _emscripten_glUniformMatrix3x2fv;
        _glUniformMatrix3x2fv.sig = "viiip";
        var _glUniformMatrix2x4fv = _emscripten_glUniformMatrix2x4fv;
        _glUniformMatrix2x4fv.sig = "viiip";
        var _glUniformMatrix4x2fv = _emscripten_glUniformMatrix4x2fv;
        _glUniformMatrix4x2fv.sig = "viiip";
        var _glUniformMatrix3x4fv = _emscripten_glUniformMatrix3x4fv;
        _glUniformMatrix3x4fv.sig = "viiip";
        var _glUniformMatrix4x3fv = _emscripten_glUniformMatrix4x3fv;
        _glUniformMatrix4x3fv.sig = "viiip";
        var _glVertexAttribI4iv = _emscripten_glVertexAttribI4iv;
        _glVertexAttribI4iv.sig = "vip";
        var _glVertexAttribI4uiv = _emscripten_glVertexAttribI4uiv;
        _glVertexAttribI4uiv.sig = "vip";
        var _glProgramParameteri = _emscripten_glProgramParameteri;
        _glProgramParameteri.sig = "viii";
        var _glGetProgramBinary = _emscripten_glGetProgramBinary;
        _glGetProgramBinary.sig = "viippp";
        var _glProgramBinary = _emscripten_glProgramBinary;
        _glProgramBinary.sig = "viipi";
        var _glFramebufferTextureLayer = _emscripten_glFramebufferTextureLayer;
        _glFramebufferTextureLayer.sig = "viiiii";
        var _glVertexAttribIPointer = _emscripten_glVertexAttribIPointer;
        _glVertexAttribIPointer.sig = "viiiip";
        var _glDrawRangeElements = _emscripten_glDrawRangeElements;
        _glDrawRangeElements.sig = "viiiiip";
        var _emscripten_glDrawArraysInstancedBaseInstanceWEBGL = (e, r, t, n, a) => {
          GLctx.dibvbi.drawArraysInstancedBaseInstanceWEBGL(e, r, t, n, a);
        };
        _emscripten_glDrawArraysInstancedBaseInstanceWEBGL.sig = "viiiii";
        var _glDrawArraysInstancedBaseInstanceWEBGL = _emscripten_glDrawArraysInstancedBaseInstanceWEBGL;
        var _emscripten_glDrawArraysInstancedBaseInstance = _glDrawArraysInstancedBaseInstanceWEBGL;
        _emscripten_glDrawArraysInstancedBaseInstance.sig = "viiiii";
        var _glDrawArraysInstancedBaseInstance = _emscripten_glDrawArraysInstancedBaseInstance;
        _glDrawArraysInstancedBaseInstance.sig = "viiiii";
        var _emscripten_glDrawArraysInstancedBaseInstanceANGLE = _glDrawArraysInstancedBaseInstanceWEBGL;
        var _glDrawArraysInstancedBaseInstanceANGLE = _emscripten_glDrawArraysInstancedBaseInstanceANGLE;
        var _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceWEBGL = (e, r, t, n, a, o, l) => {
          GLctx.dibvbi.drawElementsInstancedBaseVertexBaseInstanceWEBGL(e, r, t, n, a, o, l);
        };
        _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceWEBGL.sig = "viiiiiii";
        var _glDrawElementsInstancedBaseVertexBaseInstanceWEBGL = _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceWEBGL;
        var _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceANGLE = _glDrawElementsInstancedBaseVertexBaseInstanceWEBGL;
        var _glDrawElementsInstancedBaseVertexBaseInstanceANGLE = _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceANGLE;
        var _emscripten_glMultiDrawArraysInstancedBaseInstanceWEBGL = (e, r, t, n, a, o) => {
          GLctx.mdibvbi.multiDrawArraysInstancedBaseInstanceWEBGL(e, HEAP32, r >> 2, HEAP32, t >> 2, HEAP32, n >> 2, HEAPU32, a >> 2, o);
        };
        _emscripten_glMultiDrawArraysInstancedBaseInstanceWEBGL.sig = "viiiiii";
        var _glMultiDrawArraysInstancedBaseInstanceWEBGL = _emscripten_glMultiDrawArraysInstancedBaseInstanceWEBGL;
        var _emscripten_glMultiDrawArraysInstancedBaseInstanceANGLE = _glMultiDrawArraysInstancedBaseInstanceWEBGL;
        var _glMultiDrawArraysInstancedBaseInstanceANGLE = _emscripten_glMultiDrawArraysInstancedBaseInstanceANGLE;
        var _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL = (e, r, t, n, a, o, l, c) => {
          GLctx.mdibvbi.multiDrawElementsInstancedBaseVertexBaseInstanceWEBGL(e, HEAP32, r >> 2, t, HEAP32, n >> 2, HEAP32, a >> 2, HEAP32, o >> 2, HEAPU32, l >> 2, c);
        };
        _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL.sig = "viiiiiiii";
        var _glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL = _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL;
        var _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE = _glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL;
        var _glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE = _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE;
        var _glEndTransformFeedback = _emscripten_glEndTransformFeedback;
        _glEndTransformFeedback.sig = "v";
        var _glPauseTransformFeedback = _emscripten_glPauseTransformFeedback;
        _glPauseTransformFeedback.sig = "v";
        var _glResumeTransformFeedback = _emscripten_glResumeTransformFeedback;
        _glResumeTransformFeedback.sig = "v";
        var _glBeginTransformFeedback = _emscripten_glBeginTransformFeedback;
        _glBeginTransformFeedback.sig = "vi";
        var _glReadBuffer = _emscripten_glReadBuffer;
        _glReadBuffer.sig = "vi";
        var _glEndQuery = _emscripten_glEndQuery;
        _glEndQuery.sig = "vi";
        var _glClearBufferfi = _emscripten_glClearBufferfi;
        _glClearBufferfi.sig = "viifi";
        var _glVertexAttribI4i = _emscripten_glVertexAttribI4i;
        _glVertexAttribI4i.sig = "viiiii";
        var _glVertexAttribI4ui = _emscripten_glVertexAttribI4ui;
        _glVertexAttribI4ui.sig = "viiiii";
        var _glCopyBufferSubData = _emscripten_glCopyBufferSubData;
        _glCopyBufferSubData.sig = "viippp";
        var _glTexStorage2D = _emscripten_glTexStorage2D;
        _glTexStorage2D.sig = "viiiii";
        var _glRenderbufferStorageMultisample = _emscripten_glRenderbufferStorageMultisample;
        _glRenderbufferStorageMultisample.sig = "viiiii";
        var _glTexStorage3D = _emscripten_glTexStorage3D;
        _glTexStorage3D.sig = "viiiiii";
        var _glCopyTexSubImage3D = _emscripten_glCopyTexSubImage3D;
        _glCopyTexSubImage3D.sig = "viiiiiiiii";
        var _glBlitFramebuffer = _emscripten_glBlitFramebuffer;
        _glBlitFramebuffer.sig = "viiiiiiiiii";
        var ALLOC_NORMAL = 0;
        var ALLOC_STACK = 1;
        var allocate = (e, r) => {
          var t;
          if (r == ALLOC_STACK) {
            t = stackAlloc(e.length);
          } else {
            t = _malloc(e.length);
          }
          if (!e.subarray && !e.slice) {
            e = new Uint8Array(e);
          }
          HEAPU8.set(e, t);
          return t;
        };
        var writeStringToMemory = (e, r, t) => {
          warnOnce("writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!");
          var n;
          var a;
          if (t) {
            a = r + lengthBytesUTF8(e);
            n = HEAP8[a];
          }
          stringToUTF8(e, r, Infinity);
          if (t) {
            HEAP8[a] = n;
          }
        };
        var writeAsciiToMemory = (e, r, t) => {
          for (var n = 0; n < e.length; ++n) {
            HEAP8[r++] = e.charCodeAt(n);
          }
          if (!t) {
            HEAP8[r] = 0;
          }
        };
        var allocateUTF8 = (...e) => stringToNewUTF8(...e);
        var allocateUTF8OnStack = (...e) => stringToUTF8OnStack(...e);
        var demangle = e => {
          demangle.recursionGuard = (demangle.recursionGuard | 0) + 1;
          if (demangle.recursionGuard > 1) {
            return e;
          } else {
            return withStackSave(() => {
              try {
                var r = e;
                if (r.startsWith("__Z")) {
                  r = r.slice(1);
                }
                var t = stringToUTF8OnStack(r);
                var n = stackAlloc(4);
                var a = ___cxa_demangle(t, 0, 0, n);
                if (HEAP32[n >> 2] === 0 && a) {
                  return UTF8ToString(a);
                }
              } catch {} finally {
                _free(a);
                if (demangle.recursionGuard < 2) {
                  --demangle.recursionGuard;
                }
              }
              return e;
            });
          }
        };
        var stackTrace = () => {
          var e = jsStackTrace();
          if (Module.extraStackTrace) {
            e += `
${Module.extraStackTrace()}`;
          }
          return e;
        };
        var print = out;
        var printErr = err;
        var jstoi_s = Number;
        function getNativeTypeSize(e) {
          switch (e) {
            case "i1":
            case "i8":
            case "u8":
              return 1;
            case "i16":
            case "u16":
              return 2;
            case "i32":
            case "u32":
              return 4;
            case "i64":
            case "u64":
              return 8;
            case "float":
              return 4;
            case "double":
              return 8;
            default:
              if (e.endsWith("*")) {
                return POINTER_SIZE;
              } else if (e[0] === "i") {
                return Number(e.slice(1)) / 8;
              } else {
                return 0;
              }
          }
        }
        var _emscripten_is_main_browser_thread = () => !ENVIRONMENT_IS_WORKER;
        var runAndAbortIfError = e => {
          try {
            return e();
          } catch (r) {
            abort(r);
          }
        };
        var _emscripten_wget = (e, r) => {
          abort("Please compile your program with async support in order to use asynchronous operations like emscripten_wget");
        };
        _emscripten_wget.sig = "ipp";
        var _emscripten_scan_registers = e => {
          abort("Please compile your program with async support in order to use asynchronous operations like emscripten_scan_registers");
        };
        _emscripten_scan_registers.sig = "vp";
        var _emscripten_fiber_swap = (e, r) => {
          abort("Please compile your program with async support in order to use asynchronous operations like emscripten_fiber_swap");
        };
        _emscripten_fiber_swap.sig = "vpp";
        var _emscripten_net_gethostbyname = e => Module.net?.gethostbyname?.(e) ?? 0;
        var _emscripten_net_connect = (e, r, t) => Module.net?.connect?.(e, r, t) ?? -1;
        var _emscripten_net_send = (e, r, t, n) => Module.net?.send?.(e, r, t, n) ?? -1;
        var _emscripten_net_recv = (e, r, t, n) => Module.net?.recv?.(e, r, t, n) ?? -1;
        var _emscripten_net_select = (e, r, t, n, a) => Module.net?.select?.(e, r, t, n, a) ?? -1;
        registerWasmPlugin();
        FS.createPreloadedFile = FS_createPreloadedFile;
        FS.preloadFile = FS_preloadFile;
        FS.staticInit();
        Module.requestAnimationFrame = MainLoop.requestAnimationFrame;
        Module.pauseMainLoop = MainLoop.pause;
        Module.resumeMainLoop = MainLoop.resume;
        MainLoop.init();
        registerPreMainLoop(() => GL.newRenderingFrameStarted());
        for (let e = 0; e < 32; ++e) {
          tempFixedLengthArray.push(new Array(e));
        }
        if (globalThis.setImmediate) {
          emSetImmediate = setImmediateWrapped;
          emClearImmediate = clearImmediateWrapped;
        } else if (globalThis.addEventListener) {
          var __setImmediate_id_counter = 0;
          var __setImmediate_queue = [];
          var __setImmediate_message_id = "_si";
          var __setImmediate_cb = e => {
            if (e.data === __setImmediate_message_id) {
              e.stopPropagation();
              __setImmediate_queue.shift()();
              ++__setImmediate_id_counter;
            }
          };
          addEventListener("message", __setImmediate_cb, true);
          emSetImmediate = e => {
            postMessage(__setImmediate_message_id, "*");
            return __setImmediate_id_counter + __setImmediate_queue.push(e) - 1;
          };
          emClearImmediate = e => {
            var r = e - __setImmediate_id_counter;
            if (r >= 0 && r < __setImmediate_queue.length) {
              __setImmediate_queue[r] = () => {};
            }
          };
        }
        var miniTempWebGLFloatBuffersStorage = new Float32Array(288);
        for (var i = 0; i <= 288; ++i) {
          miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i);
        }
        var miniTempWebGLIntBuffersStorage = new Int32Array(288);
        for (var i = 0; i <= 288; ++i) {
          miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i);
        }
        if (Module.preloadPlugins) {
          preloadPlugins = Module.preloadPlugins;
        }
        if (Module.noExitRuntime) {
          noExitRuntime = Module.noExitRuntime;
        }
        if (Module.print) {
          out = Module.print;
        }
        if (Module.printErr) {
          err = Module.printErr;
        }
        if (Module.dynamicLibraries) {
          dynamicLibraries = Module.dynamicLibraries;
        }
        if (Module.wasmBinary) {
          wasmBinary = Module.wasmBinary;
        }
        if (Module.arguments) {
          arguments_ = Module.arguments;
        }
        if (Module.thisProgram) {
          thisProgram = Module.thisProgram;
        }
        if (Module.preInit) {
          for (typeof Module.preInit == "function" && (Module.preInit = [Module.preInit]); Module.preInit.length > 0;) {
            Module.preInit.shift()();
          }
        }
        Module.callMain = callMain;
        Module.addRunDependency = addRunDependency;
        Module.removeRunDependency = removeRunDependency;
        Module.ccall = ccall;
        Module.createContext = createContext;
        Module.FS = FS;
        Module._setTempRet0 = _setTempRet0;
        Module._getTempRet0 = _getTempRet0;
        Module._sched_yield = _sched_yield;
        Module.___cxa_uncaught_exceptions = ___cxa_uncaught_exceptions;
        Module.___cxa_current_primary_exception = ___cxa_current_primary_exception;
        Module.___cxa_rethrow_primary_exception = ___cxa_rethrow_primary_exception;
        Module.___syscall_shutdown = ___syscall_shutdown;
        Module._emscripten_wget = _emscripten_wget;
        var ASM_CONSTS = {
          790556: () => {
            Module.callbacks?.gameReady?.();
          },
          790592: (e, r) => {
            let t = e;
            let a = getWasmTableEntry(r).name;
            let o = Object.entries(LDSO.loadedLibsByHandle[t]?.exports ?? {});
            for (let [l, {
              name: c
            }] of o) {
              if (c === a) {
                return stringToUTF8OnStack(l);
              }
            }
            return 0;
          },
          790876: (e, r) => {
            Module.callbacks?.serverInfo?.(e, UTF8ToString(r));
          },
          790933: e => {
            var r = `${UTF8ToString(e)}

Abort/Retry/Ignore/AlwaysIgnore? [ariA] :`;
            var t = window.prompt(r, "i");
            if (t === null) {
              t = "i";
            }
            if (t.length === 1) {
              return t.charCodeAt(0);
            } else {
              return -1;
            }
          },
          791148: () => typeof AudioContext !== "undefined" ? true : typeof webkitAudioContext !== "undefined",
          791295: () => typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia !== "undefined" ? true : typeof navigator.webkitGetUserMedia !== "undefined",
          791529: e => {
            if (typeof Module.SDL2 === "undefined") {
              Module.SDL2 = {};
            }
            var r = Module.SDL2;
            if (e) {
              r.capture = {};
            } else {
              r.audio = {};
            }
            if (!r.audioContext) {
              if (typeof AudioContext !== "undefined") {
                r.audioContext = new AudioContext();
              } else if (typeof webkitAudioContext !== "undefined") {
                r.audioContext = new webkitAudioContext();
              }
              if (r.audioContext && typeof navigator.userActivation === "undefined") {
                autoResumeAudioContext(r.audioContext);
              }
            }
            if (r.audioContext === undefined) {
              return -1;
            } else {
              return 0;
            }
          },
          792081: () => {
            var e = Module.SDL2;
            return e.audioContext.sampleRate;
          },
          792149: (e, r, t, n) => {
            var a = Module.SDL2;
            var o = function (_) {
              if (a.capture.silenceTimer !== undefined) {
                clearInterval(a.capture.silenceTimer);
                a.capture.silenceTimer = undefined;
                a.capture.silenceBuffer = undefined;
              }
              a.capture.mediaStreamNode = a.audioContext.createMediaStreamSource(_);
              a.capture.scriptProcessorNode = a.audioContext.createScriptProcessor(r, e, 1);
              a.capture.scriptProcessorNode.onaudioprocess = function (u) {
                if (a !== undefined && a.capture !== undefined) {
                  u.outputBuffer.getChannelData(0).fill(0);
                  a.capture.currentCaptureBuffer = u.inputBuffer;
                  dynCall("vp", t, [n]);
                }
              };
              a.capture.mediaStreamNode.connect(a.capture.scriptProcessorNode);
              a.capture.scriptProcessorNode.connect(a.audioContext.destination);
              a.capture.stream = _;
            };
            var l = function (_) {};
            a.capture.silenceBuffer = a.audioContext.createBuffer(e, r, a.audioContext.sampleRate);
            a.capture.silenceBuffer.getChannelData(0).fill(0);
            var c = function () {
              a.capture.currentCaptureBuffer = a.capture.silenceBuffer;
              dynCall("vp", t, [n]);
            };
            a.capture.silenceTimer = setInterval(c, r / a.audioContext.sampleRate * 1000);
            if (navigator.mediaDevices !== undefined && navigator.mediaDevices.getUserMedia !== undefined) {
              navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
              }).then(o).catch(l);
            } else if (navigator.webkitGetUserMedia !== undefined) {
              navigator.webkitGetUserMedia({
                audio: true,
                video: false
              }, o, l);
            }
          },
          793842: (e, r, t, n) => {
            var a = Module.SDL2;
            a.audio.scriptProcessorNode = a.audioContext.createScriptProcessor(r, 0, e);
            a.audio.scriptProcessorNode.onaudioprocess = function (l) {
              if (a !== undefined && a.audio !== undefined) {
                if (a.audio.silenceTimer !== undefined) {
                  clearInterval(a.audio.silenceTimer);
                  a.audio.silenceTimer = undefined;
                  a.audio.silenceBuffer = undefined;
                }
                a.audio.currentOutputBuffer = l.outputBuffer;
                dynCall("vp", t, [n]);
              }
            };
            a.audio.scriptProcessorNode.connect(a.audioContext.destination);
            if (a.audioContext.state === "suspended") {
              a.audio.silenceBuffer = a.audioContext.createBuffer(e, r, a.audioContext.sampleRate);
              a.audio.silenceBuffer.getChannelData(0).fill(0);
              var o = function () {
                if (typeof navigator.userActivation !== "undefined" && navigator.userActivation.hasBeenActive) {
                  a.audioContext.resume();
                }
                a.audio.currentOutputBuffer = a.audio.silenceBuffer;
                dynCall("vp", t, [n]);
                a.audio.currentOutputBuffer = undefined;
              };
              a.audio.silenceTimer = setInterval(o, r / a.audioContext.sampleRate * 1000);
            }
          },
          795017: (e, r) => {
            var t = Module.SDL2;
            for (var n = t.capture.currentCaptureBuffer.numberOfChannels, a = 0; a < n; ++a) {
              var o = t.capture.currentCaptureBuffer.getChannelData(a);
              if (o.length != r) {
                throw "Web Audio capture buffer length mismatch! Destination size: " + o.length + " samples vs expected " + r + " samples!";
              }
              if (n == 1) {
                for (var l = 0; l < r; ++l) {
                  setValue(e + l * 4, o[l], "float");
                }
              } else {
                for (var l = 0; l < r; ++l) {
                  setValue(e + (l * n + a) * 4, o[l], "float");
                }
              }
            }
          },
          795622: (e, r) => {
            var t = Module.SDL2;
            var n = e >>> 2;
            for (var a = t.audio.currentOutputBuffer.numberOfChannels, o = 0; o < a; ++o) {
              var l = t.audio.currentOutputBuffer.getChannelData(o);
              if (l.length != r) {
                throw "Web Audio output buffer length mismatch! Destination size: " + l.length + " samples vs expected " + r + " samples!";
              }
              for (var c = 0; c < r; ++c) {
                l[c] = HEAPF32[n + (c * a + o)];
              }
            }
          },
          796111: e => {
            var r = Module.SDL2;
            if (e) {
              if (r.capture.silenceTimer !== undefined) {
                clearInterval(r.capture.silenceTimer);
              }
              if (r.capture.stream !== undefined) {
                for (var t = r.capture.stream.getAudioTracks(), n = 0; n < t.length; n++) {
                  r.capture.stream.removeTrack(t[n]);
                }
              }
              if (r.capture.scriptProcessorNode !== undefined) {
                r.capture.scriptProcessorNode.onaudioprocess = function (a) {};
                r.capture.scriptProcessorNode.disconnect();
              }
              if (r.capture.mediaStreamNode !== undefined) {
                r.capture.mediaStreamNode.disconnect();
              }
              r.capture = undefined;
            } else {
              if (r.audio.scriptProcessorNode != null) {
                r.audio.scriptProcessorNode.disconnect();
              }
              if (r.audio.silenceTimer !== undefined) {
                clearInterval(r.audio.silenceTimer);
              }
              r.audio = undefined;
            }
            if (r.audioContext !== undefined && r.audio === undefined && r.capture === undefined) {
              r.audioContext.close();
              r.audioContext = undefined;
            }
          },
          797117: (e, r, t) => {
            var n = e;
            var a = r;
            var o = t;
            Module.SDL2 ||= {};
            var l = Module.SDL2;
            if (l.ctxCanvas !== Module.canvas) {
              l.ctx = Browser.createContext(Module.canvas, false, true);
              l.ctxCanvas = Module.canvas;
            }
            if (l.w !== n || l.h !== a || l.imageCtx !== l.ctx) {
              l.image = l.ctx.createImageData(n, a);
              l.w = n;
              l.h = a;
              l.imageCtx = l.ctx;
            }
            var c = l.image.data;
            var _ = o / 4;
            var u = 0;
            var m;
            if (typeof CanvasPixelArray !== "undefined" && c instanceof CanvasPixelArray) {
              for (m = c.length; u < m;) {
                var f = HEAP32[_];
                c[u] = f & 255;
                c[u + 1] = f >> 8 & 255;
                c[u + 2] = f >> 16 & 255;
                c[u + 3] = 255;
                _++;
                u += 4;
              }
            } else {
              if (l.data32Data !== c) {
                l.data32 = new Int32Array(c.buffer);
                l.data8 = new Uint8Array(c.buffer);
                l.data32Data = c;
              }
              var v = l.data32;
              m = v.length;
              v.set(HEAP32.subarray(_, _ + m));
              var g = l.data8;
              var h = 3;
              var p = h + m * 4;
              if (m % 8 == 0) {
                while (h < p) {
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                  g[h] = 255;
                  h = h + 4 | 0;
                }
              } else {
                while (h < p) {
                  g[h] = 255;
                  h = h + 4 | 0;
                }
              }
            }
            l.ctx.putImageData(l.image, 0, 0);
          },
          798583: (e, r, t, n, a) => {
            var o = e;
            var l = r;
            var c = t;
            var _ = n;
            var u = a;
            var m = document.createElement("canvas");
            m.width = o;
            m.height = l;
            var f = m.getContext("2d");
            var v = f.createImageData(o, l);
            var g = v.data;
            var h = u / 4;
            var p = 0;
            var b;
            if (typeof CanvasPixelArray !== "undefined" && g instanceof CanvasPixelArray) {
              for (b = g.length; p < b;) {
                var S = HEAP32[h];
                g[p] = S & 255;
                g[p + 1] = S >> 8 & 255;
                g[p + 2] = S >> 16 & 255;
                g[p + 3] = S >> 24 & 255;
                h++;
                p += 4;
              }
            } else {
              var w = new Int32Array(g.buffer);
              b = w.length;
              w.set(HEAP32.subarray(h, h + b));
            }
            f.putImageData(v, 0, 0);
            var A = c === 0 && _ === 0 ? "url(" + m.toDataURL() + "), auto" : "url(" + m.toDataURL() + ") " + c + " " + _ + ", auto";
            var k = _malloc(A.length + 1);
            stringToUTF8(A, k, A.length + 1);
            return k;
          },
          799571: e => {
            if (Module.canvas) {
              Module.canvas.style.cursor = UTF8ToString(e);
            }
          },
          799654: () => {
            if (Module.canvas) {
              Module.canvas.style.cursor = "none";
            }
          },
          799723: () => window.innerWidth,
          799753: () => window.innerHeight,
          799784: (e, r) => {
            var t = e;
            var n = r;
            var a = undefined;
            if (navigator.languages && navigator.languages.length) {
              a = navigator.languages;
            } else {
              var o = navigator.userLanguage || navigator.language || navigator.browserLanguage || navigator.systemLanguage;
              if (o !== undefined) {
                a = [o];
              }
            }
            if (a !== undefined) {
              var l = "";
              for (var c = 0; c < a.length; c++) {
                var _ = a[c];
                if (l.length + _.length + 1 > n) {
                  break;
                }
                if (l.length > 0) {
                  l += ",";
                }
                l += _;
              }
              l = l.replace(/-/g, "_");
              if (n > l.length) {
                n = l.length;
              }
              for (var c = 0; c < n; c++) {
                setValue(t + c, l.charCodeAt(c), "i8");
              }
            }
          },
          800492: e => {
            window.open(UTF8ToString(e), "_blank");
          },
          800532: (e, r) => {
            alert(`${UTF8ToString(e)}

${UTF8ToString(r)}`);
          },
          800589: e => {
            if (!e) {
              AL.alcErr = 40964;
              return 1;
            }
          },
          800637: e => {
            if (!AL.currentCtx) {
              err("alGetProcAddress() called without a valid context");
              return 1;
            }
            if (!e) {
              AL.currentCtx.err = 40963;
              return 1;
            }
          }
        };
        var _Cmd_ExecuteString;
        var _malloc;
        var _free;
        var _strerror;
        var _main;
        var _htons;
        var _htonl;
        var _ntohs;
        var _fileno;
        var _calloc;
        var _realloc;
        var _getErrnoLocation;
        var ___dl_seterr;
        var __emscripten_find_dylib;
        var _emscripten_builtin_memalign;
        var __emscripten_timeout;
        var _emscripten_get_sbrk_ptr;
        var _setThrew;
        var __emscripten_tempret_set;
        var __emscripten_tempret_get;
        var __emscripten_stack_restore;
        var __emscripten_stack_alloc;
        var _emscripten_stack_get_current;
        var ___cxa_demangle;
        var ___cxa_increment_exception_refcount;
        var ___cxa_decrement_exception_refcount;
        var ___cxa_can_catch;
        var ___cxa_get_exception_ptr;
        var memory;
        var ___stack_pointer;
        var __indirect_function_table;
        var ___heap_base;
        var wasmTable;
        var wasmMemory;
        function assignWasmExports(e) {
          _Cmd_ExecuteString = Module._Cmd_ExecuteString = e.Cmd_ExecuteString;
          _malloc = e.malloc;
          _free = e.free;
          _strerror = e.strerror;
          _main = Module._main = e.__main_argc_argv;
          _htons = e.htons;
          _htonl = e.htonl;
          _ntohs = e.ntohs;
          _fileno = e.fileno;
          _calloc = e.calloc;
          _realloc = e.realloc;
          _getErrnoLocation = Module._getErrnoLocation = e.getErrnoLocation;
          ___dl_seterr = e.__dl_seterr;
          __emscripten_find_dylib = e._emscripten_find_dylib;
          _emscripten_builtin_memalign = e.emscripten_builtin_memalign;
          __emscripten_timeout = e._emscripten_timeout;
          _emscripten_get_sbrk_ptr = e.emscripten_get_sbrk_ptr;
          _setThrew = e.setThrew;
          __emscripten_tempret_set = e._emscripten_tempret_set;
          __emscripten_tempret_get = e._emscripten_tempret_get;
          __emscripten_stack_restore = e._emscripten_stack_restore;
          __emscripten_stack_alloc = e._emscripten_stack_alloc;
          _emscripten_stack_get_current = e.emscripten_stack_get_current;
          ___cxa_demangle = e.__cxa_demangle;
          ___cxa_increment_exception_refcount = e.__cxa_increment_exception_refcount;
          ___cxa_decrement_exception_refcount = e.__cxa_decrement_exception_refcount;
          ___cxa_can_catch = e.__cxa_can_catch;
          ___cxa_get_exception_ptr = e.__cxa_get_exception_ptr;
          memory = wasmMemory = e.memory;
          ___stack_pointer = e.__stack_pointer;
          __indirect_function_table = wasmTable = e.__indirect_function_table;
          ___heap_base = e.__heap_base.value;
        }
        var wasmImports = {
          _Unwind_Backtrace: __Unwind_Backtrace,
          _Unwind_DeleteException: __Unwind_DeleteException,
          _Unwind_FindEnclosingFunction: __Unwind_FindEnclosingFunction,
          _Unwind_GetIPInfo: __Unwind_GetIPInfo,
          _Unwind_RaiseException: __Unwind_RaiseException,
          __asctime_r: ___asctime_r,
          __assert_fail: ___assert_fail,
          __call_sighandler: ___call_sighandler,
          __cxa_begin_catch: ___cxa_begin_catch,
          __cxa_call_unexpected: ___cxa_call_unexpected,
          __cxa_current_exception_type: ___cxa_current_exception_type,
          __cxa_end_catch: ___cxa_end_catch,
          __cxa_find_matching_catch_2: ___cxa_find_matching_catch_2,
          __cxa_find_matching_catch_3: ___cxa_find_matching_catch_3,
          __cxa_find_matching_catch_4: ___cxa_find_matching_catch_4,
          __cxa_rethrow: ___cxa_rethrow,
          __cxa_throw: ___cxa_throw,
          __resumeException: ___resumeException,
          __syscall_accept4: ___syscall_accept4,
          __syscall_bind: ___syscall_bind,
          __syscall_chdir: ___syscall_chdir,
          __syscall_chmod: ___syscall_chmod,
          __syscall_connect: ___syscall_connect,
          __syscall_dup: ___syscall_dup,
          __syscall_dup3: ___syscall_dup3,
          __syscall_faccessat: ___syscall_faccessat,
          __syscall_fadvise64: ___syscall_fadvise64,
          __syscall_fallocate: ___syscall_fallocate,
          __syscall_fchdir: ___syscall_fchdir,
          __syscall_fchmod: ___syscall_fchmod,
          __syscall_fchmodat2: ___syscall_fchmodat2,
          __syscall_fchown32: ___syscall_fchown32,
          __syscall_fchownat: ___syscall_fchownat,
          __syscall_fcntl64: ___syscall_fcntl64,
          __syscall_fdatasync: ___syscall_fdatasync,
          __syscall_fstat64: ___syscall_fstat64,
          __syscall_fstatfs64: ___syscall_fstatfs64,
          __syscall_ftruncate64: ___syscall_ftruncate64,
          __syscall_getcwd: ___syscall_getcwd,
          __syscall_getdents64: ___syscall_getdents64,
          __syscall_getpeername: ___syscall_getpeername,
          __syscall_getsockname: ___syscall_getsockname,
          __syscall_getsockopt: ___syscall_getsockopt,
          __syscall_ioctl: ___syscall_ioctl,
          __syscall_listen: ___syscall_listen,
          __syscall_lstat64: ___syscall_lstat64,
          __syscall_mkdirat: ___syscall_mkdirat,
          __syscall_mknodat: ___syscall_mknodat,
          __syscall_newfstatat: ___syscall_newfstatat,
          __syscall_openat: ___syscall_openat,
          __syscall_pipe: ___syscall_pipe,
          __syscall_readlinkat: ___syscall_readlinkat,
          __syscall_recvfrom: ___syscall_recvfrom,
          __syscall_recvmsg: ___syscall_recvmsg,
          __syscall_renameat: ___syscall_renameat,
          __syscall_rmdir: ___syscall_rmdir,
          __syscall_sendmsg: ___syscall_sendmsg,
          __syscall_sendto: ___syscall_sendto,
          __syscall_socket: ___syscall_socket,
          __syscall_stat64: ___syscall_stat64,
          __syscall_statfs64: ___syscall_statfs64,
          __syscall_symlinkat: ___syscall_symlinkat,
          __syscall_truncate64: ___syscall_truncate64,
          __syscall_unlinkat: ___syscall_unlinkat,
          __syscall_utimensat: ___syscall_utimensat,
          _abort_js: __abort_js,
          _dlopen_js: __dlopen_js,
          _dlsym_catchup_js: __dlsym_catchup_js,
          _dlsym_js: __dlsym_js,
          _emscripten_dlopen_js: __emscripten_dlopen_js,
          _emscripten_fs_load_embedded_files: __emscripten_fs_load_embedded_files,
          _emscripten_get_last_devicemotion_event: __emscripten_get_last_devicemotion_event,
          _emscripten_get_last_deviceorientation_event: __emscripten_get_last_deviceorientation_event,
          _emscripten_get_last_mouse_event: __emscripten_get_last_mouse_event,
          _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
          _emscripten_get_progname: __emscripten_get_progname,
          _emscripten_log_formatted: __emscripten_log_formatted,
          _emscripten_lookup_name: __emscripten_lookup_name,
          _emscripten_push_main_loop_blocker: __emscripten_push_main_loop_blocker,
          _emscripten_push_uncounted_main_loop_blocker: __emscripten_push_uncounted_main_loop_blocker,
          _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear,
          _emscripten_system: __emscripten_system,
          _emscripten_throw_longjmp: __emscripten_throw_longjmp,
          _glGetActiveAttribOrUniform: __glGetActiveAttribOrUniform,
          _gmtime_js: __gmtime_js,
          _localtime_js: __localtime_js,
          _mktime_js: __mktime_js,
          _mmap_js: __mmap_js,
          _msync_js: __msync_js,
          _munmap_js: __munmap_js,
          _poll_js: __poll_js,
          _setitimer_js: __setitimer_js,
          _timegm_js: __timegm_js,
          _tzset_js: __tzset_js,
          alBuffer3f: _alBuffer3f,
          alBuffer3i: _alBuffer3i,
          alBufferData: _alBufferData,
          alBufferf: _alBufferf,
          alBufferfv: _alBufferfv,
          alBufferi: _alBufferi,
          alBufferiv: _alBufferiv,
          alDeleteBuffers: _alDeleteBuffers,
          alDeleteSources: _alDeleteSources,
          alDisable: _alDisable,
          alDistanceModel: _alDistanceModel,
          alDopplerFactor: _alDopplerFactor,
          alDopplerVelocity: _alDopplerVelocity,
          alEnable: _alEnable,
          alGenBuffers: _alGenBuffers,
          alGenSources: _alGenSources,
          alGetBoolean: _alGetBoolean,
          alGetBooleanv: _alGetBooleanv,
          alGetBuffer3f: _alGetBuffer3f,
          alGetBuffer3i: _alGetBuffer3i,
          alGetBufferf: _alGetBufferf,
          alGetBufferfv: _alGetBufferfv,
          alGetBufferi: _alGetBufferi,
          alGetBufferiv: _alGetBufferiv,
          alGetDouble: _alGetDouble,
          alGetDoublev: _alGetDoublev,
          alGetEnumValue: _alGetEnumValue,
          alGetError: _alGetError,
          alGetFloat: _alGetFloat,
          alGetFloatv: _alGetFloatv,
          alGetInteger: _alGetInteger,
          alGetIntegerv: _alGetIntegerv,
          alGetListener3f: _alGetListener3f,
          alGetListener3i: _alGetListener3i,
          alGetListenerf: _alGetListenerf,
          alGetListenerfv: _alGetListenerfv,
          alGetListeneri: _alGetListeneri,
          alGetListeneriv: _alGetListeneriv,
          alGetSource3f: _alGetSource3f,
          alGetSource3i: _alGetSource3i,
          alGetSourcef: _alGetSourcef,
          alGetSourcefv: _alGetSourcefv,
          alGetSourcei: _alGetSourcei,
          alGetSourceiv: _alGetSourceiv,
          alGetString: _alGetString,
          alIsBuffer: _alIsBuffer,
          alIsEnabled: _alIsEnabled,
          alIsExtensionPresent: _alIsExtensionPresent,
          alIsSource: _alIsSource,
          alListener3f: _alListener3f,
          alListener3i: _alListener3i,
          alListenerf: _alListenerf,
          alListenerfv: _alListenerfv,
          alListeneri: _alListeneri,
          alListeneriv: _alListeneriv,
          alSource3f: _alSource3f,
          alSource3i: _alSource3i,
          alSourcePause: _alSourcePause,
          alSourcePausev: _alSourcePausev,
          alSourcePlay: _alSourcePlay,
          alSourcePlayv: _alSourcePlayv,
          alSourceQueueBuffers: _alSourceQueueBuffers,
          alSourceRewind: _alSourceRewind,
          alSourceRewindv: _alSourceRewindv,
          alSourceStop: _alSourceStop,
          alSourceStopv: _alSourceStopv,
          alSourceUnqueueBuffers: _alSourceUnqueueBuffers,
          alSourcef: _alSourcef,
          alSourcefv: _alSourcefv,
          alSourcei: _alSourcei,
          alSourceiv: _alSourceiv,
          alSpeedOfSound: _alSpeedOfSound,
          alcCaptureCloseDevice: _alcCaptureCloseDevice,
          alcCaptureOpenDevice: _alcCaptureOpenDevice,
          alcCaptureSamples: _alcCaptureSamples,
          alcCaptureStart: _alcCaptureStart,
          alcCaptureStop: _alcCaptureStop,
          alcCloseDevice: _alcCloseDevice,
          alcCreateContext: _alcCreateContext,
          alcDestroyContext: _alcDestroyContext,
          alcGetContextsDevice: _alcGetContextsDevice,
          alcGetCurrentContext: _alcGetCurrentContext,
          alcGetEnumValue: _alcGetEnumValue,
          alcGetError: _alcGetError,
          alcGetIntegerv: _alcGetIntegerv,
          alcGetString: _alcGetString,
          alcIsExtensionPresent: _alcIsExtensionPresent,
          alcMakeContextCurrent: _alcMakeContextCurrent,
          alcOpenDevice: _alcOpenDevice,
          alcProcessContext: _alcProcessContext,
          alcSuspendContext: _alcSuspendContext,
          clock_res_get: _clock_res_get,
          clock_time_get: _clock_time_get,
          eglBindAPI: _eglBindAPI,
          eglChooseConfig: _eglChooseConfig,
          eglCreateContext: _eglCreateContext,
          eglCreateWindowSurface: _eglCreateWindowSurface,
          eglDestroyContext: _eglDestroyContext,
          eglDestroySurface: _eglDestroySurface,
          eglGetConfigAttrib: _eglGetConfigAttrib,
          eglGetConfigs: _eglGetConfigs,
          eglGetCurrentContext: _eglGetCurrentContext,
          eglGetCurrentDisplay: _eglGetCurrentDisplay,
          eglGetCurrentSurface: _eglGetCurrentSurface,
          eglGetDisplay: _eglGetDisplay,
          eglGetError: _eglGetError,
          eglInitialize: _eglInitialize,
          eglMakeCurrent: _eglMakeCurrent,
          eglQueryAPI: _eglQueryAPI,
          eglQueryContext: _eglQueryContext,
          eglQueryString: _eglQueryString,
          eglQuerySurface: _eglQuerySurface,
          eglReleaseThread: _eglReleaseThread,
          eglSwapBuffers: _eglSwapBuffers,
          eglSwapInterval: _eglSwapInterval,
          eglTerminate: _eglTerminate,
          eglWaitClient: _eglWaitClient,
          eglWaitGL: _eglWaitGL,
          eglWaitNative: _eglWaitNative,
          emscripten_alcDevicePauseSOFT: _emscripten_alcDevicePauseSOFT,
          emscripten_alcDeviceResumeSOFT: _emscripten_alcDeviceResumeSOFT,
          emscripten_alcGetStringiSOFT: _emscripten_alcGetStringiSOFT,
          emscripten_alcResetDeviceSOFT: _emscripten_alcResetDeviceSOFT,
          emscripten_asm_const_async_on_main_thread: _emscripten_asm_const_async_on_main_thread,
          emscripten_asm_const_double: _emscripten_asm_const_double,
          emscripten_asm_const_double_sync_on_main_thread: _emscripten_asm_const_double_sync_on_main_thread,
          emscripten_asm_const_int: _emscripten_asm_const_int,
          emscripten_asm_const_int_sync_on_main_thread: _emscripten_asm_const_int_sync_on_main_thread,
          emscripten_asm_const_ptr: _emscripten_asm_const_ptr,
          emscripten_asm_const_ptr_sync_on_main_thread: _emscripten_asm_const_ptr_sync_on_main_thread,
          emscripten_async_call: _emscripten_async_call,
          emscripten_async_load_script: _emscripten_async_load_script,
          emscripten_async_run_script: _emscripten_async_run_script,
          emscripten_async_wget: _emscripten_async_wget,
          emscripten_async_wget2: _emscripten_async_wget2,
          emscripten_async_wget2_abort: _emscripten_async_wget2_abort,
          emscripten_async_wget2_data: _emscripten_async_wget2_data,
          emscripten_async_wget_data: _emscripten_async_wget_data,
          emscripten_call_worker: _emscripten_call_worker,
          emscripten_cancel_animation_frame: _emscripten_cancel_animation_frame,
          emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
          emscripten_clear_immediate: _emscripten_clear_immediate,
          emscripten_clear_interval: _emscripten_clear_interval,
          emscripten_clear_timeout: _emscripten_clear_timeout,
          emscripten_console_error: _emscripten_console_error,
          emscripten_console_log: _emscripten_console_log,
          emscripten_console_trace: _emscripten_console_trace,
          emscripten_console_warn: _emscripten_console_warn,
          emscripten_create_worker: _emscripten_create_worker,
          emscripten_date_now: _emscripten_date_now,
          emscripten_debugger: _emscripten_debugger,
          emscripten_destroy_worker: _emscripten_destroy_worker,
          emscripten_enter_soft_fullscreen: _emscripten_enter_soft_fullscreen,
          emscripten_err: _emscripten_err,
          emscripten_errn: _emscripten_errn,
          emscripten_exit_fullscreen: _emscripten_exit_fullscreen,
          emscripten_exit_pointerlock: _emscripten_exit_pointerlock,
          emscripten_exit_soft_fullscreen: _emscripten_exit_soft_fullscreen,
          emscripten_exit_with_live_runtime: _emscripten_exit_with_live_runtime,
          emscripten_fiber_swap: _emscripten_fiber_swap,
          emscripten_force_exit: _emscripten_force_exit,
          emscripten_get_battery_status: _emscripten_get_battery_status,
          emscripten_get_callstack: _emscripten_get_callstack,
          emscripten_get_canvas_element_size: _emscripten_get_canvas_element_size,
          emscripten_get_canvas_size: _emscripten_get_canvas_size,
          emscripten_get_compiler_setting: _emscripten_get_compiler_setting,
          emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
          emscripten_get_element_css_size: _emscripten_get_element_css_size,
          emscripten_get_fullscreen_status: _emscripten_get_fullscreen_status,
          emscripten_get_gamepad_status: _emscripten_get_gamepad_status,
          emscripten_get_heap_max: _emscripten_get_heap_max,
          emscripten_get_main_loop_timing: _emscripten_get_main_loop_timing,
          emscripten_get_now: _emscripten_get_now,
          emscripten_get_now_res: _emscripten_get_now_res,
          emscripten_get_num_gamepads: _emscripten_get_num_gamepads,
          emscripten_get_orientation_status: _emscripten_get_orientation_status,
          emscripten_get_pointerlock_status: _emscripten_get_pointerlock_status,
          emscripten_get_preloaded_image_data: _emscripten_get_preloaded_image_data,
          emscripten_get_preloaded_image_data_from_FILE: _emscripten_get_preloaded_image_data_from_FILE,
          emscripten_get_screen_size: _emscripten_get_screen_size,
          emscripten_get_visibility_status: _emscripten_get_visibility_status,
          emscripten_get_window_title: _emscripten_get_window_title,
          emscripten_get_worker_queue_size: _emscripten_get_worker_queue_size,
          emscripten_glActiveTexture: _emscripten_glActiveTexture,
          emscripten_glAttachShader: _emscripten_glAttachShader,
          emscripten_glBegin: _emscripten_glBegin,
          emscripten_glBeginQuery: _emscripten_glBeginQuery,
          emscripten_glBeginQueryEXT: _emscripten_glBeginQueryEXT,
          emscripten_glBeginTransformFeedback: _emscripten_glBeginTransformFeedback,
          emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
          emscripten_glBindBuffer: _emscripten_glBindBuffer,
          emscripten_glBindBufferBase: _emscripten_glBindBufferBase,
          emscripten_glBindBufferRange: _emscripten_glBindBufferRange,
          emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
          emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
          emscripten_glBindSampler: _emscripten_glBindSampler,
          emscripten_glBindTexture: _emscripten_glBindTexture,
          emscripten_glBindTransformFeedback: _emscripten_glBindTransformFeedback,
          emscripten_glBindVertexArray: _emscripten_glBindVertexArray,
          emscripten_glBindVertexArrayOES: _emscripten_glBindVertexArrayOES,
          emscripten_glBlendColor: _emscripten_glBlendColor,
          emscripten_glBlendEquation: _emscripten_glBlendEquation,
          emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
          emscripten_glBlendFunc: _emscripten_glBlendFunc,
          emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
          emscripten_glBlitFramebuffer: _emscripten_glBlitFramebuffer,
          emscripten_glBufferData: _emscripten_glBufferData,
          emscripten_glBufferSubData: _emscripten_glBufferSubData,
          emscripten_glCheckFramebufferStatus: _emscripten_glCheckFramebufferStatus,
          emscripten_glClear: _emscripten_glClear,
          emscripten_glClearBufferfi: _emscripten_glClearBufferfi,
          emscripten_glClearBufferfv: _emscripten_glClearBufferfv,
          emscripten_glClearBufferiv: _emscripten_glClearBufferiv,
          emscripten_glClearBufferuiv: _emscripten_glClearBufferuiv,
          emscripten_glClearColor: _emscripten_glClearColor,
          emscripten_glClearDepth: _emscripten_glClearDepth,
          emscripten_glClearDepthf: _emscripten_glClearDepthf,
          emscripten_glClearStencil: _emscripten_glClearStencil,
          emscripten_glClientWaitSync: _emscripten_glClientWaitSync,
          emscripten_glClipControlEXT: _emscripten_glClipControlEXT,
          emscripten_glColorMask: _emscripten_glColorMask,
          emscripten_glCompileShader: _emscripten_glCompileShader,
          emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
          emscripten_glCompressedTexImage3D: _emscripten_glCompressedTexImage3D,
          emscripten_glCompressedTexSubImage2D: _emscripten_glCompressedTexSubImage2D,
          emscripten_glCompressedTexSubImage3D: _emscripten_glCompressedTexSubImage3D,
          emscripten_glCopyBufferSubData: _emscripten_glCopyBufferSubData,
          emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
          emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
          emscripten_glCopyTexSubImage3D: _emscripten_glCopyTexSubImage3D,
          emscripten_glCreateProgram: _emscripten_glCreateProgram,
          emscripten_glCreateShader: _emscripten_glCreateShader,
          emscripten_glCullFace: _emscripten_glCullFace,
          emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
          emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
          emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
          emscripten_glDeleteQueries: _emscripten_glDeleteQueries,
          emscripten_glDeleteQueriesEXT: _emscripten_glDeleteQueriesEXT,
          emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
          emscripten_glDeleteSamplers: _emscripten_glDeleteSamplers,
          emscripten_glDeleteShader: _emscripten_glDeleteShader,
          emscripten_glDeleteSync: _emscripten_glDeleteSync,
          emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
          emscripten_glDeleteTransformFeedbacks: _emscripten_glDeleteTransformFeedbacks,
          emscripten_glDeleteVertexArrays: _emscripten_glDeleteVertexArrays,
          emscripten_glDeleteVertexArraysOES: _emscripten_glDeleteVertexArraysOES,
          emscripten_glDepthFunc: _emscripten_glDepthFunc,
          emscripten_glDepthMask: _emscripten_glDepthMask,
          emscripten_glDepthRange: _emscripten_glDepthRange,
          emscripten_glDepthRangef: _emscripten_glDepthRangef,
          emscripten_glDetachShader: _emscripten_glDetachShader,
          emscripten_glDisable: _emscripten_glDisable,
          emscripten_glDisableVertexAttribArray: _emscripten_glDisableVertexAttribArray,
          emscripten_glDrawArrays: _emscripten_glDrawArrays,
          emscripten_glDrawArraysInstanced: _emscripten_glDrawArraysInstanced,
          emscripten_glDrawArraysInstancedANGLE: _emscripten_glDrawArraysInstancedANGLE,
          emscripten_glDrawArraysInstancedARB: _emscripten_glDrawArraysInstancedARB,
          emscripten_glDrawArraysInstancedBaseInstance: _emscripten_glDrawArraysInstancedBaseInstance,
          emscripten_glDrawArraysInstancedBaseInstanceANGLE: _emscripten_glDrawArraysInstancedBaseInstanceANGLE,
          emscripten_glDrawArraysInstancedBaseInstanceWEBGL: _emscripten_glDrawArraysInstancedBaseInstanceWEBGL,
          emscripten_glDrawArraysInstancedEXT: _emscripten_glDrawArraysInstancedEXT,
          emscripten_glDrawArraysInstancedNV: _emscripten_glDrawArraysInstancedNV,
          emscripten_glDrawBuffers: _emscripten_glDrawBuffers,
          emscripten_glDrawBuffersEXT: _emscripten_glDrawBuffersEXT,
          emscripten_glDrawBuffersWEBGL: _emscripten_glDrawBuffersWEBGL,
          emscripten_glDrawElements: _emscripten_glDrawElements,
          emscripten_glDrawElementsInstanced: _emscripten_glDrawElementsInstanced,
          emscripten_glDrawElementsInstancedANGLE: _emscripten_glDrawElementsInstancedANGLE,
          emscripten_glDrawElementsInstancedARB: _emscripten_glDrawElementsInstancedARB,
          emscripten_glDrawElementsInstancedBaseVertexBaseInstanceANGLE: _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceANGLE,
          emscripten_glDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _emscripten_glDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
          emscripten_glDrawElementsInstancedEXT: _emscripten_glDrawElementsInstancedEXT,
          emscripten_glDrawElementsInstancedNV: _emscripten_glDrawElementsInstancedNV,
          emscripten_glDrawRangeElements: _emscripten_glDrawRangeElements,
          emscripten_glEnable: _emscripten_glEnable,
          emscripten_glEnableVertexAttribArray: _emscripten_glEnableVertexAttribArray,
          emscripten_glEndQuery: _emscripten_glEndQuery,
          emscripten_glEndQueryEXT: _emscripten_glEndQueryEXT,
          emscripten_glEndTransformFeedback: _emscripten_glEndTransformFeedback,
          emscripten_glFenceSync: _emscripten_glFenceSync,
          emscripten_glFinish: _emscripten_glFinish,
          emscripten_glFlush: _emscripten_glFlush,
          emscripten_glFramebufferRenderbuffer: _emscripten_glFramebufferRenderbuffer,
          emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
          emscripten_glFramebufferTextureLayer: _emscripten_glFramebufferTextureLayer,
          emscripten_glFrontFace: _emscripten_glFrontFace,
          emscripten_glGenBuffers: _emscripten_glGenBuffers,
          emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
          emscripten_glGenQueries: _emscripten_glGenQueries,
          emscripten_glGenQueriesEXT: _emscripten_glGenQueriesEXT,
          emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
          emscripten_glGenSamplers: _emscripten_glGenSamplers,
          emscripten_glGenTextures: _emscripten_glGenTextures,
          emscripten_glGenTransformFeedbacks: _emscripten_glGenTransformFeedbacks,
          emscripten_glGenVertexArrays: _emscripten_glGenVertexArrays,
          emscripten_glGenVertexArraysOES: _emscripten_glGenVertexArraysOES,
          emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
          emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
          emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
          emscripten_glGetActiveUniformBlockName: _emscripten_glGetActiveUniformBlockName,
          emscripten_glGetActiveUniformBlockiv: _emscripten_glGetActiveUniformBlockiv,
          emscripten_glGetActiveUniformsiv: _emscripten_glGetActiveUniformsiv,
          emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
          emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
          emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
          emscripten_glGetBufferParameteri64v: _emscripten_glGetBufferParameteri64v,
          emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
          emscripten_glGetBufferSubData: _emscripten_glGetBufferSubData,
          emscripten_glGetError: _emscripten_glGetError,
          emscripten_glGetFloatv: _emscripten_glGetFloatv,
          emscripten_glGetFragDataLocation: _emscripten_glGetFragDataLocation,
          emscripten_glGetFramebufferAttachmentParameteriv: _emscripten_glGetFramebufferAttachmentParameteriv,
          emscripten_glGetInteger64i_v: _emscripten_glGetInteger64i_v,
          emscripten_glGetInteger64v: _emscripten_glGetInteger64v,
          emscripten_glGetIntegeri_v: _emscripten_glGetIntegeri_v,
          emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
          emscripten_glGetInternalformativ: _emscripten_glGetInternalformativ,
          emscripten_glGetProgramBinary: _emscripten_glGetProgramBinary,
          emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
          emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
          emscripten_glGetQueryObjecti64vEXT: _emscripten_glGetQueryObjecti64vEXT,
          emscripten_glGetQueryObjectivEXT: _emscripten_glGetQueryObjectivEXT,
          emscripten_glGetQueryObjectui64vEXT: _emscripten_glGetQueryObjectui64vEXT,
          emscripten_glGetQueryObjectuiv: _emscripten_glGetQueryObjectuiv,
          emscripten_glGetQueryObjectuivEXT: _emscripten_glGetQueryObjectuivEXT,
          emscripten_glGetQueryiv: _emscripten_glGetQueryiv,
          emscripten_glGetQueryivEXT: _emscripten_glGetQueryivEXT,
          emscripten_glGetRenderbufferParameteriv: _emscripten_glGetRenderbufferParameteriv,
          emscripten_glGetSamplerParameterfv: _emscripten_glGetSamplerParameterfv,
          emscripten_glGetSamplerParameteriv: _emscripten_glGetSamplerParameteriv,
          emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
          emscripten_glGetShaderPrecisionFormat: _emscripten_glGetShaderPrecisionFormat,
          emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
          emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
          emscripten_glGetString: _emscripten_glGetString,
          emscripten_glGetStringi: _emscripten_glGetStringi,
          emscripten_glGetSynciv: _emscripten_glGetSynciv,
          emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
          emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
          emscripten_glGetTransformFeedbackVarying: _emscripten_glGetTransformFeedbackVarying,
          emscripten_glGetUniformBlockIndex: _emscripten_glGetUniformBlockIndex,
          emscripten_glGetUniformIndices: _emscripten_glGetUniformIndices,
          emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
          emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
          emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
          emscripten_glGetUniformuiv: _emscripten_glGetUniformuiv,
          emscripten_glGetVertexAttribIiv: _emscripten_glGetVertexAttribIiv,
          emscripten_glGetVertexAttribIuiv: _emscripten_glGetVertexAttribIuiv,
          emscripten_glGetVertexAttribPointerv: _emscripten_glGetVertexAttribPointerv,
          emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
          emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
          emscripten_glHint: _emscripten_glHint,
          emscripten_glInvalidateFramebuffer: _emscripten_glInvalidateFramebuffer,
          emscripten_glInvalidateSubFramebuffer: _emscripten_glInvalidateSubFramebuffer,
          emscripten_glIsBuffer: _emscripten_glIsBuffer,
          emscripten_glIsEnabled: _emscripten_glIsEnabled,
          emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
          emscripten_glIsProgram: _emscripten_glIsProgram,
          emscripten_glIsQuery: _emscripten_glIsQuery,
          emscripten_glIsQueryEXT: _emscripten_glIsQueryEXT,
          emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
          emscripten_glIsSampler: _emscripten_glIsSampler,
          emscripten_glIsShader: _emscripten_glIsShader,
          emscripten_glIsSync: _emscripten_glIsSync,
          emscripten_glIsTexture: _emscripten_glIsTexture,
          emscripten_glIsTransformFeedback: _emscripten_glIsTransformFeedback,
          emscripten_glIsVertexArray: _emscripten_glIsVertexArray,
          emscripten_glIsVertexArrayOES: _emscripten_glIsVertexArrayOES,
          emscripten_glLineWidth: _emscripten_glLineWidth,
          emscripten_glLinkProgram: _emscripten_glLinkProgram,
          emscripten_glLoadIdentity: _emscripten_glLoadIdentity,
          emscripten_glMatrixMode: _emscripten_glMatrixMode,
          emscripten_glMultiDrawArrays: _emscripten_glMultiDrawArrays,
          emscripten_glMultiDrawArraysANGLE: _emscripten_glMultiDrawArraysANGLE,
          emscripten_glMultiDrawArraysInstancedANGLE: _emscripten_glMultiDrawArraysInstancedANGLE,
          emscripten_glMultiDrawArraysInstancedBaseInstanceANGLE: _emscripten_glMultiDrawArraysInstancedBaseInstanceANGLE,
          emscripten_glMultiDrawArraysInstancedBaseInstanceWEBGL: _emscripten_glMultiDrawArraysInstancedBaseInstanceWEBGL,
          emscripten_glMultiDrawArraysInstancedWEBGL: _emscripten_glMultiDrawArraysInstancedWEBGL,
          emscripten_glMultiDrawArraysWEBGL: _emscripten_glMultiDrawArraysWEBGL,
          emscripten_glMultiDrawElements: _emscripten_glMultiDrawElements,
          emscripten_glMultiDrawElementsANGLE: _emscripten_glMultiDrawElementsANGLE,
          emscripten_glMultiDrawElementsInstancedANGLE: _emscripten_glMultiDrawElementsInstancedANGLE,
          emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE: _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE,
          emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _emscripten_glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
          emscripten_glMultiDrawElementsInstancedWEBGL: _emscripten_glMultiDrawElementsInstancedWEBGL,
          emscripten_glMultiDrawElementsWEBGL: _emscripten_glMultiDrawElementsWEBGL,
          emscripten_glPauseTransformFeedback: _emscripten_glPauseTransformFeedback,
          emscripten_glPixelStorei: _emscripten_glPixelStorei,
          emscripten_glPolygonModeWEBGL: _emscripten_glPolygonModeWEBGL,
          emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
          emscripten_glPolygonOffsetClampEXT: _emscripten_glPolygonOffsetClampEXT,
          emscripten_glProgramBinary: _emscripten_glProgramBinary,
          emscripten_glProgramParameteri: _emscripten_glProgramParameteri,
          emscripten_glQueryCounterEXT: _emscripten_glQueryCounterEXT,
          emscripten_glReadBuffer: _emscripten_glReadBuffer,
          emscripten_glReadPixels: _emscripten_glReadPixels,
          emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
          emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
          emscripten_glRenderbufferStorageMultisample: _emscripten_glRenderbufferStorageMultisample,
          emscripten_glResumeTransformFeedback: _emscripten_glResumeTransformFeedback,
          emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
          emscripten_glSamplerParameterf: _emscripten_glSamplerParameterf,
          emscripten_glSamplerParameterfv: _emscripten_glSamplerParameterfv,
          emscripten_glSamplerParameteri: _emscripten_glSamplerParameteri,
          emscripten_glSamplerParameteriv: _emscripten_glSamplerParameteriv,
          emscripten_glScissor: _emscripten_glScissor,
          emscripten_glShaderBinary: _emscripten_glShaderBinary,
          emscripten_glShaderSource: _emscripten_glShaderSource,
          emscripten_glStencilFunc: _emscripten_glStencilFunc,
          emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
          emscripten_glStencilMask: _emscripten_glStencilMask,
          emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
          emscripten_glStencilOp: _emscripten_glStencilOp,
          emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
          emscripten_glTexImage2D: _emscripten_glTexImage2D,
          emscripten_glTexImage3D: _emscripten_glTexImage3D,
          emscripten_glTexParameterf: _emscripten_glTexParameterf,
          emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
          emscripten_glTexParameteri: _emscripten_glTexParameteri,
          emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
          emscripten_glTexStorage2D: _emscripten_glTexStorage2D,
          emscripten_glTexStorage3D: _emscripten_glTexStorage3D,
          emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
          emscripten_glTexSubImage3D: _emscripten_glTexSubImage3D,
          emscripten_glTransformFeedbackVaryings: _emscripten_glTransformFeedbackVaryings,
          emscripten_glUniform1f: _emscripten_glUniform1f,
          emscripten_glUniform1fv: _emscripten_glUniform1fv,
          emscripten_glUniform1i: _emscripten_glUniform1i,
          emscripten_glUniform1iv: _emscripten_glUniform1iv,
          emscripten_glUniform1ui: _emscripten_glUniform1ui,
          emscripten_glUniform1uiv: _emscripten_glUniform1uiv,
          emscripten_glUniform2f: _emscripten_glUniform2f,
          emscripten_glUniform2fv: _emscripten_glUniform2fv,
          emscripten_glUniform2i: _emscripten_glUniform2i,
          emscripten_glUniform2iv: _emscripten_glUniform2iv,
          emscripten_glUniform2ui: _emscripten_glUniform2ui,
          emscripten_glUniform2uiv: _emscripten_glUniform2uiv,
          emscripten_glUniform3f: _emscripten_glUniform3f,
          emscripten_glUniform3fv: _emscripten_glUniform3fv,
          emscripten_glUniform3i: _emscripten_glUniform3i,
          emscripten_glUniform3iv: _emscripten_glUniform3iv,
          emscripten_glUniform3ui: _emscripten_glUniform3ui,
          emscripten_glUniform3uiv: _emscripten_glUniform3uiv,
          emscripten_glUniform4f: _emscripten_glUniform4f,
          emscripten_glUniform4fv: _emscripten_glUniform4fv,
          emscripten_glUniform4i: _emscripten_glUniform4i,
          emscripten_glUniform4iv: _emscripten_glUniform4iv,
          emscripten_glUniform4ui: _emscripten_glUniform4ui,
          emscripten_glUniform4uiv: _emscripten_glUniform4uiv,
          emscripten_glUniformBlockBinding: _emscripten_glUniformBlockBinding,
          emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
          emscripten_glUniformMatrix2x3fv: _emscripten_glUniformMatrix2x3fv,
          emscripten_glUniformMatrix2x4fv: _emscripten_glUniformMatrix2x4fv,
          emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
          emscripten_glUniformMatrix3x2fv: _emscripten_glUniformMatrix3x2fv,
          emscripten_glUniformMatrix3x4fv: _emscripten_glUniformMatrix3x4fv,
          emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
          emscripten_glUniformMatrix4x2fv: _emscripten_glUniformMatrix4x2fv,
          emscripten_glUniformMatrix4x3fv: _emscripten_glUniformMatrix4x3fv,
          emscripten_glUseProgram: _emscripten_glUseProgram,
          emscripten_glValidateProgram: _emscripten_glValidateProgram,
          emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
          emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
          emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
          emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
          emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
          emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
          emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
          emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
          emscripten_glVertexAttribDivisor: _emscripten_glVertexAttribDivisor,
          emscripten_glVertexAttribDivisorANGLE: _emscripten_glVertexAttribDivisorANGLE,
          emscripten_glVertexAttribDivisorARB: _emscripten_glVertexAttribDivisorARB,
          emscripten_glVertexAttribDivisorEXT: _emscripten_glVertexAttribDivisorEXT,
          emscripten_glVertexAttribDivisorNV: _emscripten_glVertexAttribDivisorNV,
          emscripten_glVertexAttribI4i: _emscripten_glVertexAttribI4i,
          emscripten_glVertexAttribI4iv: _emscripten_glVertexAttribI4iv,
          emscripten_glVertexAttribI4ui: _emscripten_glVertexAttribI4ui,
          emscripten_glVertexAttribI4uiv: _emscripten_glVertexAttribI4uiv,
          emscripten_glVertexAttribIPointer: _emscripten_glVertexAttribIPointer,
          emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
          emscripten_glVertexPointer: _emscripten_glVertexPointer,
          emscripten_glViewport: _emscripten_glViewport,
          emscripten_glWaitSync: _emscripten_glWaitSync,
          emscripten_has_asyncify: _emscripten_has_asyncify,
          emscripten_hide_mouse: _emscripten_hide_mouse,
          emscripten_html5_remove_all_event_listeners: _emscripten_html5_remove_all_event_listeners,
          emscripten_html5_remove_event_listener: _emscripten_html5_remove_event_listener,
          emscripten_is_main_browser_thread: _emscripten_is_main_browser_thread,
          emscripten_is_webgl_context_lost: _emscripten_is_webgl_context_lost,
          emscripten_lock_orientation: _emscripten_lock_orientation,
          emscripten_math_acos: _emscripten_math_acos,
          emscripten_math_acosh: _emscripten_math_acosh,
          emscripten_math_asin: _emscripten_math_asin,
          emscripten_math_asinh: _emscripten_math_asinh,
          emscripten_math_atan: _emscripten_math_atan,
          emscripten_math_atan2: _emscripten_math_atan2,
          emscripten_math_atanh: _emscripten_math_atanh,
          emscripten_math_cbrt: _emscripten_math_cbrt,
          emscripten_math_cos: _emscripten_math_cos,
          emscripten_math_cosh: _emscripten_math_cosh,
          emscripten_math_exp: _emscripten_math_exp,
          emscripten_math_expm1: _emscripten_math_expm1,
          emscripten_math_fmod: _emscripten_math_fmod,
          emscripten_math_hypot: _emscripten_math_hypot,
          emscripten_math_log: _emscripten_math_log,
          emscripten_math_log10: _emscripten_math_log10,
          emscripten_math_log1p: _emscripten_math_log1p,
          emscripten_math_log2: _emscripten_math_log2,
          emscripten_math_pow: _emscripten_math_pow,
          emscripten_math_random: _emscripten_math_random,
          emscripten_math_round: _emscripten_math_round,
          emscripten_math_sign: _emscripten_math_sign,
          emscripten_math_sin: _emscripten_math_sin,
          emscripten_math_sinh: _emscripten_math_sinh,
          emscripten_math_sqrt: _emscripten_math_sqrt,
          emscripten_math_tan: _emscripten_math_tan,
          emscripten_math_tanh: _emscripten_math_tanh,
          emscripten_net_bind: _emscripten_net_bind,
          emscripten_net_closesocket: _emscripten_net_closesocket,
          emscripten_net_connect: _emscripten_net_connect,
          emscripten_net_getaddrinfo: _emscripten_net_getaddrinfo,
          emscripten_net_gethostbyname: _emscripten_net_gethostbyname,
          emscripten_net_gethostname: _emscripten_net_gethostname,
          emscripten_net_getsockname: _emscripten_net_getsockname,
          emscripten_net_recv: _emscripten_net_recv,
          emscripten_net_recvfrom: _emscripten_net_recvfrom,
          emscripten_net_select: _emscripten_net_select,
          emscripten_net_send: _emscripten_net_send,
          emscripten_net_sendto: _emscripten_net_sendto,
          emscripten_net_sendto_batch: _emscripten_net_sendto_batch,
          emscripten_net_socket: _emscripten_net_socket,
          emscripten_notify_memory_growth: _emscripten_notify_memory_growth,
          emscripten_out: _emscripten_out,
          emscripten_outn: _emscripten_outn,
          emscripten_pause_main_loop: _emscripten_pause_main_loop,
          emscripten_pc_get_column: _emscripten_pc_get_column,
          emscripten_pc_get_file: _emscripten_pc_get_file,
          emscripten_pc_get_function: _emscripten_pc_get_function,
          emscripten_pc_get_line: _emscripten_pc_get_line,
          emscripten_performance_now: _emscripten_performance_now,
          emscripten_print_double: _emscripten_print_double,
          emscripten_promise_all: _emscripten_promise_all,
          emscripten_promise_all_settled: _emscripten_promise_all_settled,
          emscripten_promise_any: _emscripten_promise_any,
          emscripten_promise_await: _emscripten_promise_await,
          emscripten_promise_create: _emscripten_promise_create,
          emscripten_promise_destroy: _emscripten_promise_destroy,
          emscripten_promise_race: _emscripten_promise_race,
          emscripten_promise_resolve: _emscripten_promise_resolve,
          emscripten_promise_then: _emscripten_promise_then,
          emscripten_random: _emscripten_random,
          emscripten_request_animation_frame: _emscripten_request_animation_frame,
          emscripten_request_animation_frame_loop: _emscripten_request_animation_frame_loop,
          emscripten_request_fullscreen: _emscripten_request_fullscreen,
          emscripten_request_fullscreen_strategy: _emscripten_request_fullscreen_strategy,
          emscripten_request_pointerlock: _emscripten_request_pointerlock,
          emscripten_resize_heap: _emscripten_resize_heap,
          emscripten_resume_main_loop: _emscripten_resume_main_loop,
          emscripten_return_address: _emscripten_return_address,
          emscripten_run_preload_plugins: _emscripten_run_preload_plugins,
          emscripten_run_preload_plugins_data: _emscripten_run_preload_plugins_data,
          emscripten_run_script: _emscripten_run_script,
          emscripten_run_script_int: _emscripten_run_script_int,
          emscripten_run_script_string: _emscripten_run_script_string,
          emscripten_runtime_keepalive_check: _emscripten_runtime_keepalive_check,
          emscripten_runtime_keepalive_pop: _emscripten_runtime_keepalive_pop,
          emscripten_runtime_keepalive_push: _emscripten_runtime_keepalive_push,
          emscripten_sample_gamepad_data: _emscripten_sample_gamepad_data,
          emscripten_scan_registers: _emscripten_scan_registers,
          emscripten_set_batterychargingchange_callback_on_thread: _emscripten_set_batterychargingchange_callback_on_thread,
          emscripten_set_batterylevelchange_callback_on_thread: _emscripten_set_batterylevelchange_callback_on_thread,
          emscripten_set_beforeunload_callback_on_thread: _emscripten_set_beforeunload_callback_on_thread,
          emscripten_set_blur_callback_on_thread: _emscripten_set_blur_callback_on_thread,
          emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
          emscripten_set_canvas_size: _emscripten_set_canvas_size,
          emscripten_set_click_callback_on_thread: _emscripten_set_click_callback_on_thread,
          emscripten_set_dblclick_callback_on_thread: _emscripten_set_dblclick_callback_on_thread,
          emscripten_set_devicemotion_callback_on_thread: _emscripten_set_devicemotion_callback_on_thread,
          emscripten_set_deviceorientation_callback_on_thread: _emscripten_set_deviceorientation_callback_on_thread,
          emscripten_set_element_css_size: _emscripten_set_element_css_size,
          emscripten_set_focus_callback_on_thread: _emscripten_set_focus_callback_on_thread,
          emscripten_set_focusin_callback_on_thread: _emscripten_set_focusin_callback_on_thread,
          emscripten_set_focusout_callback_on_thread: _emscripten_set_focusout_callback_on_thread,
          emscripten_set_fullscreenchange_callback_on_thread: _emscripten_set_fullscreenchange_callback_on_thread,
          emscripten_set_gamepadconnected_callback_on_thread: _emscripten_set_gamepadconnected_callback_on_thread,
          emscripten_set_gamepaddisconnected_callback_on_thread: _emscripten_set_gamepaddisconnected_callback_on_thread,
          emscripten_set_immediate: _emscripten_set_immediate,
          emscripten_set_immediate_loop: _emscripten_set_immediate_loop,
          emscripten_set_interval: _emscripten_set_interval,
          emscripten_set_keydown_callback_on_thread: _emscripten_set_keydown_callback_on_thread,
          emscripten_set_keypress_callback_on_thread: _emscripten_set_keypress_callback_on_thread,
          emscripten_set_keyup_callback_on_thread: _emscripten_set_keyup_callback_on_thread,
          emscripten_set_main_loop: _emscripten_set_main_loop,
          emscripten_set_main_loop_arg: _emscripten_set_main_loop_arg,
          emscripten_set_main_loop_expected_blockers: _emscripten_set_main_loop_expected_blockers,
          emscripten_set_main_loop_timing: _emscripten_set_main_loop_timing,
          emscripten_set_mousedown_callback_on_thread: _emscripten_set_mousedown_callback_on_thread,
          emscripten_set_mouseenter_callback_on_thread: _emscripten_set_mouseenter_callback_on_thread,
          emscripten_set_mouseleave_callback_on_thread: _emscripten_set_mouseleave_callback_on_thread,
          emscripten_set_mousemove_callback_on_thread: _emscripten_set_mousemove_callback_on_thread,
          emscripten_set_mouseout_callback_on_thread: _emscripten_set_mouseout_callback_on_thread,
          emscripten_set_mouseover_callback_on_thread: _emscripten_set_mouseover_callback_on_thread,
          emscripten_set_mouseup_callback_on_thread: _emscripten_set_mouseup_callback_on_thread,
          emscripten_set_orientationchange_callback_on_thread: _emscripten_set_orientationchange_callback_on_thread,
          emscripten_set_pointerlockchange_callback_on_thread: _emscripten_set_pointerlockchange_callback_on_thread,
          emscripten_set_pointerlockerror_callback_on_thread: _emscripten_set_pointerlockerror_callback_on_thread,
          emscripten_set_resize_callback_on_thread: _emscripten_set_resize_callback_on_thread,
          emscripten_set_scroll_callback_on_thread: _emscripten_set_scroll_callback_on_thread,
          emscripten_set_socket_close_callback: _emscripten_set_socket_close_callback,
          emscripten_set_socket_connection_callback: _emscripten_set_socket_connection_callback,
          emscripten_set_socket_error_callback: _emscripten_set_socket_error_callback,
          emscripten_set_socket_listen_callback: _emscripten_set_socket_listen_callback,
          emscripten_set_socket_message_callback: _emscripten_set_socket_message_callback,
          emscripten_set_socket_open_callback: _emscripten_set_socket_open_callback,
          emscripten_set_timeout: _emscripten_set_timeout,
          emscripten_set_timeout_loop: _emscripten_set_timeout_loop,
          emscripten_set_touchcancel_callback_on_thread: _emscripten_set_touchcancel_callback_on_thread,
          emscripten_set_touchend_callback_on_thread: _emscripten_set_touchend_callback_on_thread,
          emscripten_set_touchmove_callback_on_thread: _emscripten_set_touchmove_callback_on_thread,
          emscripten_set_touchstart_callback_on_thread: _emscripten_set_touchstart_callback_on_thread,
          emscripten_set_visibilitychange_callback_on_thread: _emscripten_set_visibilitychange_callback_on_thread,
          emscripten_set_webglcontextlost_callback_on_thread: _emscripten_set_webglcontextlost_callback_on_thread,
          emscripten_set_webglcontextrestored_callback_on_thread: _emscripten_set_webglcontextrestored_callback_on_thread,
          emscripten_set_wheel_callback_on_thread: _emscripten_set_wheel_callback_on_thread,
          emscripten_set_window_title: _emscripten_set_window_title,
          emscripten_sleep: _emscripten_sleep,
          emscripten_stack_snapshot: _emscripten_stack_snapshot,
          emscripten_stack_unwind_buffer: _emscripten_stack_unwind_buffer,
          emscripten_supports_offscreencanvas: _emscripten_supports_offscreencanvas,
          emscripten_throw_number: _emscripten_throw_number,
          emscripten_throw_string: _emscripten_throw_string,
          emscripten_unlock_orientation: _emscripten_unlock_orientation,
          emscripten_unwind_to_js_event_loop: _emscripten_unwind_to_js_event_loop,
          emscripten_vibrate: _emscripten_vibrate,
          emscripten_vibrate_pattern: _emscripten_vibrate_pattern,
          emscripten_webgl_commit_frame: _emscripten_webgl_commit_frame,
          emscripten_webgl_create_context: _emscripten_webgl_create_context,
          emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
          emscripten_webgl_do_commit_frame: _emscripten_webgl_do_commit_frame,
          emscripten_webgl_do_create_context: _emscripten_webgl_do_create_context,
          emscripten_webgl_do_get_current_context: _emscripten_webgl_do_get_current_context,
          emscripten_webgl_enable_EXT_clip_control: _emscripten_webgl_enable_EXT_clip_control,
          emscripten_webgl_enable_EXT_polygon_offset_clamp: _emscripten_webgl_enable_EXT_polygon_offset_clamp,
          emscripten_webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance: _emscripten_webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance,
          emscripten_webgl_enable_WEBGL_multi_draw: _emscripten_webgl_enable_WEBGL_multi_draw,
          emscripten_webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance: _emscripten_webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance,
          emscripten_webgl_enable_WEBGL_polygon_mode: _emscripten_webgl_enable_WEBGL_polygon_mode,
          emscripten_webgl_enable_extension: _emscripten_webgl_enable_extension,
          emscripten_webgl_get_context_attributes: _emscripten_webgl_get_context_attributes,
          emscripten_webgl_get_current_context: _emscripten_webgl_get_current_context,
          emscripten_webgl_get_drawing_buffer_size: _emscripten_webgl_get_drawing_buffer_size,
          emscripten_webgl_get_parameter_d: _emscripten_webgl_get_parameter_d,
          emscripten_webgl_get_parameter_i64v: _emscripten_webgl_get_parameter_i64v,
          emscripten_webgl_get_parameter_o: _emscripten_webgl_get_parameter_o,
          emscripten_webgl_get_parameter_utf8: _emscripten_webgl_get_parameter_utf8,
          emscripten_webgl_get_parameter_v: _emscripten_webgl_get_parameter_v,
          emscripten_webgl_get_program_info_log_utf8: _emscripten_webgl_get_program_info_log_utf8,
          emscripten_webgl_get_program_parameter_d: _emscripten_webgl_get_program_parameter_d,
          emscripten_webgl_get_shader_info_log_utf8: _emscripten_webgl_get_shader_info_log_utf8,
          emscripten_webgl_get_shader_parameter_d: _emscripten_webgl_get_shader_parameter_d,
          emscripten_webgl_get_shader_source_utf8: _emscripten_webgl_get_shader_source_utf8,
          emscripten_webgl_get_supported_extensions: _emscripten_webgl_get_supported_extensions,
          emscripten_webgl_get_uniform_d: _emscripten_webgl_get_uniform_d,
          emscripten_webgl_get_uniform_v: _emscripten_webgl_get_uniform_v,
          emscripten_webgl_get_vertex_attrib_d: _emscripten_webgl_get_vertex_attrib_d,
          emscripten_webgl_get_vertex_attrib_o: _emscripten_webgl_get_vertex_attrib_o,
          emscripten_webgl_get_vertex_attrib_v: _emscripten_webgl_get_vertex_attrib_v,
          emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
          emscripten_wget_data: _emscripten_wget_data,
          endprotoent: _endprotoent,
          environ_get: _environ_get,
          environ_sizes_get: _environ_sizes_get,
          exit: _exit,
          fd_close: _fd_close,
          fd_fdstat_get: _fd_fdstat_get,
          fd_pread: _fd_pread,
          fd_pwrite: _fd_pwrite,
          fd_read: _fd_read,
          fd_seek: _fd_seek,
          fd_sync: _fd_sync,
          fd_write: _fd_write,
          getaddrinfo: _getaddrinfo,
          getnameinfo: _getnameinfo,
          getprotobyname: _getprotobyname,
          getprotobynumber: _getprotobynumber,
          getprotoent: _getprotoent,
          glActiveTexture: _glActiveTexture,
          glAttachShader: _glAttachShader,
          glBegin: _glBegin,
          glBeginQuery: _glBeginQuery,
          glBeginQueryEXT: _glBeginQueryEXT,
          glBeginTransformFeedback: _glBeginTransformFeedback,
          glBindAttribLocation: _glBindAttribLocation,
          glBindBuffer: _glBindBuffer,
          glBindBufferBase: _glBindBufferBase,
          glBindBufferRange: _glBindBufferRange,
          glBindFramebuffer: _glBindFramebuffer,
          glBindRenderbuffer: _glBindRenderbuffer,
          glBindSampler: _glBindSampler,
          glBindTexture: _glBindTexture,
          glBindTransformFeedback: _glBindTransformFeedback,
          glBindVertexArray: _glBindVertexArray,
          glBindVertexArrayOES: _glBindVertexArrayOES,
          glBlendColor: _glBlendColor,
          glBlendEquation: _glBlendEquation,
          glBlendEquationSeparate: _glBlendEquationSeparate,
          glBlendFunc: _glBlendFunc,
          glBlendFuncSeparate: _glBlendFuncSeparate,
          glBlitFramebuffer: _glBlitFramebuffer,
          glBufferData: _glBufferData,
          glBufferSubData: _glBufferSubData,
          glCheckFramebufferStatus: _glCheckFramebufferStatus,
          glClear: _glClear,
          glClearBufferfi: _glClearBufferfi,
          glClearBufferfv: _glClearBufferfv,
          glClearBufferiv: _glClearBufferiv,
          glClearBufferuiv: _glClearBufferuiv,
          glClearColor: _glClearColor,
          glClearDepth: _glClearDepth,
          glClearDepthf: _glClearDepthf,
          glClearStencil: _glClearStencil,
          glClientWaitSync: _glClientWaitSync,
          glClipControlEXT: _glClipControlEXT,
          glColorMask: _glColorMask,
          glCompileShader: _glCompileShader,
          glCompressedTexImage2D: _glCompressedTexImage2D,
          glCompressedTexImage3D: _glCompressedTexImage3D,
          glCompressedTexSubImage2D: _glCompressedTexSubImage2D,
          glCompressedTexSubImage3D: _glCompressedTexSubImage3D,
          glCopyBufferSubData: _glCopyBufferSubData,
          glCopyTexImage2D: _glCopyTexImage2D,
          glCopyTexSubImage2D: _glCopyTexSubImage2D,
          glCopyTexSubImage3D: _glCopyTexSubImage3D,
          glCreateProgram: _glCreateProgram,
          glCreateShader: _glCreateShader,
          glCullFace: _glCullFace,
          glDeleteBuffers: _glDeleteBuffers,
          glDeleteFramebuffers: _glDeleteFramebuffers,
          glDeleteProgram: _glDeleteProgram,
          glDeleteQueries: _glDeleteQueries,
          glDeleteQueriesEXT: _glDeleteQueriesEXT,
          glDeleteRenderbuffers: _glDeleteRenderbuffers,
          glDeleteSamplers: _glDeleteSamplers,
          glDeleteShader: _glDeleteShader,
          glDeleteSync: _glDeleteSync,
          glDeleteTextures: _glDeleteTextures,
          glDeleteTransformFeedbacks: _glDeleteTransformFeedbacks,
          glDeleteVertexArrays: _glDeleteVertexArrays,
          glDeleteVertexArraysOES: _glDeleteVertexArraysOES,
          glDepthFunc: _glDepthFunc,
          glDepthMask: _glDepthMask,
          glDepthRange: _glDepthRange,
          glDepthRangef: _glDepthRangef,
          glDetachShader: _glDetachShader,
          glDisable: _glDisable,
          glDisableVertexAttribArray: _glDisableVertexAttribArray,
          glDrawArrays: _glDrawArrays,
          glDrawArraysInstanced: _glDrawArraysInstanced,
          glDrawArraysInstancedANGLE: _glDrawArraysInstancedANGLE,
          glDrawArraysInstancedARB: _glDrawArraysInstancedARB,
          glDrawArraysInstancedBaseInstance: _glDrawArraysInstancedBaseInstance,
          glDrawArraysInstancedBaseInstanceANGLE: _glDrawArraysInstancedBaseInstanceANGLE,
          glDrawArraysInstancedBaseInstanceWEBGL: _glDrawArraysInstancedBaseInstanceWEBGL,
          glDrawArraysInstancedEXT: _glDrawArraysInstancedEXT,
          glDrawArraysInstancedNV: _glDrawArraysInstancedNV,
          glDrawBuffers: _glDrawBuffers,
          glDrawBuffersEXT: _glDrawBuffersEXT,
          glDrawBuffersWEBGL: _glDrawBuffersWEBGL,
          glDrawElements: _glDrawElements,
          glDrawElementsInstanced: _glDrawElementsInstanced,
          glDrawElementsInstancedANGLE: _glDrawElementsInstancedANGLE,
          glDrawElementsInstancedARB: _glDrawElementsInstancedARB,
          glDrawElementsInstancedBaseVertexBaseInstanceANGLE: _glDrawElementsInstancedBaseVertexBaseInstanceANGLE,
          glDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _glDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
          glDrawElementsInstancedEXT: _glDrawElementsInstancedEXT,
          glDrawElementsInstancedNV: _glDrawElementsInstancedNV,
          glDrawRangeElements: _glDrawRangeElements,
          glEnable: _glEnable,
          glEnableVertexAttribArray: _glEnableVertexAttribArray,
          glEndQuery: _glEndQuery,
          glEndQueryEXT: _glEndQueryEXT,
          glEndTransformFeedback: _glEndTransformFeedback,
          glFenceSync: _glFenceSync,
          glFinish: _glFinish,
          glFlush: _glFlush,
          glFramebufferRenderbuffer: _glFramebufferRenderbuffer,
          glFramebufferTexture2D: _glFramebufferTexture2D,
          glFramebufferTextureLayer: _glFramebufferTextureLayer,
          glFrontFace: _glFrontFace,
          glGenBuffers: _glGenBuffers,
          glGenFramebuffers: _glGenFramebuffers,
          glGenQueries: _glGenQueries,
          glGenQueriesEXT: _glGenQueriesEXT,
          glGenRenderbuffers: _glGenRenderbuffers,
          glGenSamplers: _glGenSamplers,
          glGenTextures: _glGenTextures,
          glGenTransformFeedbacks: _glGenTransformFeedbacks,
          glGenVertexArrays: _glGenVertexArrays,
          glGenVertexArraysOES: _glGenVertexArraysOES,
          glGenerateMipmap: _glGenerateMipmap,
          glGetActiveAttrib: _glGetActiveAttrib,
          glGetActiveUniform: _glGetActiveUniform,
          glGetActiveUniformBlockName: _glGetActiveUniformBlockName,
          glGetActiveUniformBlockiv: _glGetActiveUniformBlockiv,
          glGetActiveUniformsiv: _glGetActiveUniformsiv,
          glGetAttachedShaders: _glGetAttachedShaders,
          glGetAttribLocation: _glGetAttribLocation,
          glGetBooleanv: _glGetBooleanv,
          glGetBufferParameteri64v: _glGetBufferParameteri64v,
          glGetBufferParameteriv: _glGetBufferParameteriv,
          glGetBufferSubData: _glGetBufferSubData,
          glGetError: _glGetError,
          glGetFloatv: _glGetFloatv,
          glGetFragDataLocation: _glGetFragDataLocation,
          glGetFramebufferAttachmentParameteriv: _glGetFramebufferAttachmentParameteriv,
          glGetInteger64i_v: _glGetInteger64i_v,
          glGetInteger64v: _glGetInteger64v,
          glGetIntegeri_v: _glGetIntegeri_v,
          glGetIntegerv: _glGetIntegerv,
          glGetInternalformativ: _glGetInternalformativ,
          glGetProgramBinary: _glGetProgramBinary,
          glGetProgramInfoLog: _glGetProgramInfoLog,
          glGetProgramiv: _glGetProgramiv,
          glGetQueryObjecti64vEXT: _glGetQueryObjecti64vEXT,
          glGetQueryObjectivEXT: _glGetQueryObjectivEXT,
          glGetQueryObjectui64vEXT: _glGetQueryObjectui64vEXT,
          glGetQueryObjectuiv: _glGetQueryObjectuiv,
          glGetQueryObjectuivEXT: _glGetQueryObjectuivEXT,
          glGetQueryiv: _glGetQueryiv,
          glGetQueryivEXT: _glGetQueryivEXT,
          glGetRenderbufferParameteriv: _glGetRenderbufferParameteriv,
          glGetSamplerParameterfv: _glGetSamplerParameterfv,
          glGetSamplerParameteriv: _glGetSamplerParameteriv,
          glGetShaderInfoLog: _glGetShaderInfoLog,
          glGetShaderPrecisionFormat: _glGetShaderPrecisionFormat,
          glGetShaderSource: _glGetShaderSource,
          glGetShaderiv: _glGetShaderiv,
          glGetString: _glGetString,
          glGetStringi: _glGetStringi,
          glGetSynciv: _glGetSynciv,
          glGetTexParameterfv: _glGetTexParameterfv,
          glGetTexParameteriv: _glGetTexParameteriv,
          glGetTransformFeedbackVarying: _glGetTransformFeedbackVarying,
          glGetUniformBlockIndex: _glGetUniformBlockIndex,
          glGetUniformIndices: _glGetUniformIndices,
          glGetUniformLocation: _glGetUniformLocation,
          glGetUniformfv: _glGetUniformfv,
          glGetUniformiv: _glGetUniformiv,
          glGetUniformuiv: _glGetUniformuiv,
          glGetVertexAttribIiv: _glGetVertexAttribIiv,
          glGetVertexAttribIuiv: _glGetVertexAttribIuiv,
          glGetVertexAttribPointerv: _glGetVertexAttribPointerv,
          glGetVertexAttribfv: _glGetVertexAttribfv,
          glGetVertexAttribiv: _glGetVertexAttribiv,
          glHint: _glHint,
          glInvalidateFramebuffer: _glInvalidateFramebuffer,
          glInvalidateSubFramebuffer: _glInvalidateSubFramebuffer,
          glIsBuffer: _glIsBuffer,
          glIsEnabled: _glIsEnabled,
          glIsFramebuffer: _glIsFramebuffer,
          glIsProgram: _glIsProgram,
          glIsQuery: _glIsQuery,
          glIsQueryEXT: _glIsQueryEXT,
          glIsRenderbuffer: _glIsRenderbuffer,
          glIsSampler: _glIsSampler,
          glIsShader: _glIsShader,
          glIsSync: _glIsSync,
          glIsTexture: _glIsTexture,
          glIsTransformFeedback: _glIsTransformFeedback,
          glIsVertexArray: _glIsVertexArray,
          glIsVertexArrayOES: _glIsVertexArrayOES,
          glLineWidth: _glLineWidth,
          glLinkProgram: _glLinkProgram,
          glLoadIdentity: _glLoadIdentity,
          glMatrixMode: _glMatrixMode,
          glMultiDrawArrays: _glMultiDrawArrays,
          glMultiDrawArraysANGLE: _glMultiDrawArraysANGLE,
          glMultiDrawArraysInstancedANGLE: _glMultiDrawArraysInstancedANGLE,
          glMultiDrawArraysInstancedBaseInstanceANGLE: _glMultiDrawArraysInstancedBaseInstanceANGLE,
          glMultiDrawArraysInstancedBaseInstanceWEBGL: _glMultiDrawArraysInstancedBaseInstanceWEBGL,
          glMultiDrawArraysInstancedWEBGL: _glMultiDrawArraysInstancedWEBGL,
          glMultiDrawArraysWEBGL: _glMultiDrawArraysWEBGL,
          glMultiDrawElements: _glMultiDrawElements,
          glMultiDrawElementsANGLE: _glMultiDrawElementsANGLE,
          glMultiDrawElementsInstancedANGLE: _glMultiDrawElementsInstancedANGLE,
          glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE: _glMultiDrawElementsInstancedBaseVertexBaseInstanceANGLE,
          glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
          glMultiDrawElementsInstancedWEBGL: _glMultiDrawElementsInstancedWEBGL,
          glMultiDrawElementsWEBGL: _glMultiDrawElementsWEBGL,
          glPauseTransformFeedback: _glPauseTransformFeedback,
          glPixelStorei: _glPixelStorei,
          glPolygonModeWEBGL: _glPolygonModeWEBGL,
          glPolygonOffset: _glPolygonOffset,
          glPolygonOffsetClampEXT: _glPolygonOffsetClampEXT,
          glProgramBinary: _glProgramBinary,
          glProgramParameteri: _glProgramParameteri,
          glQueryCounterEXT: _glQueryCounterEXT,
          glReadBuffer: _glReadBuffer,
          glReadPixels: _glReadPixels,
          glReleaseShaderCompiler: _glReleaseShaderCompiler,
          glRenderbufferStorage: _glRenderbufferStorage,
          glRenderbufferStorageMultisample: _glRenderbufferStorageMultisample,
          glResumeTransformFeedback: _glResumeTransformFeedback,
          glSampleCoverage: _glSampleCoverage,
          glSamplerParameterf: _glSamplerParameterf,
          glSamplerParameterfv: _glSamplerParameterfv,
          glSamplerParameteri: _glSamplerParameteri,
          glSamplerParameteriv: _glSamplerParameteriv,
          glScissor: _glScissor,
          glShaderBinary: _glShaderBinary,
          glShaderSource: _glShaderSource,
          glStencilFunc: _glStencilFunc,
          glStencilFuncSeparate: _glStencilFuncSeparate,
          glStencilMask: _glStencilMask,
          glStencilMaskSeparate: _glStencilMaskSeparate,
          glStencilOp: _glStencilOp,
          glStencilOpSeparate: _glStencilOpSeparate,
          glTexImage2D: _glTexImage2D,
          glTexImage3D: _glTexImage3D,
          glTexParameterf: _glTexParameterf,
          glTexParameterfv: _glTexParameterfv,
          glTexParameteri: _glTexParameteri,
          glTexParameteriv: _glTexParameteriv,
          glTexStorage2D: _glTexStorage2D,
          glTexStorage3D: _glTexStorage3D,
          glTexSubImage2D: _glTexSubImage2D,
          glTexSubImage3D: _glTexSubImage3D,
          glTransformFeedbackVaryings: _glTransformFeedbackVaryings,
          glUniform1f: _glUniform1f,
          glUniform1fv: _glUniform1fv,
          glUniform1i: _glUniform1i,
          glUniform1iv: _glUniform1iv,
          glUniform1ui: _glUniform1ui,
          glUniform1uiv: _glUniform1uiv,
          glUniform2f: _glUniform2f,
          glUniform2fv: _glUniform2fv,
          glUniform2i: _glUniform2i,
          glUniform2iv: _glUniform2iv,
          glUniform2ui: _glUniform2ui,
          glUniform2uiv: _glUniform2uiv,
          glUniform3f: _glUniform3f,
          glUniform3fv: _glUniform3fv,
          glUniform3i: _glUniform3i,
          glUniform3iv: _glUniform3iv,
          glUniform3ui: _glUniform3ui,
          glUniform3uiv: _glUniform3uiv,
          glUniform4f: _glUniform4f,
          glUniform4fv: _glUniform4fv,
          glUniform4i: _glUniform4i,
          glUniform4iv: _glUniform4iv,
          glUniform4ui: _glUniform4ui,
          glUniform4uiv: _glUniform4uiv,
          glUniformBlockBinding: _glUniformBlockBinding,
          glUniformMatrix2fv: _glUniformMatrix2fv,
          glUniformMatrix2x3fv: _glUniformMatrix2x3fv,
          glUniformMatrix2x4fv: _glUniformMatrix2x4fv,
          glUniformMatrix3fv: _glUniformMatrix3fv,
          glUniformMatrix3x2fv: _glUniformMatrix3x2fv,
          glUniformMatrix3x4fv: _glUniformMatrix3x4fv,
          glUniformMatrix4fv: _glUniformMatrix4fv,
          glUniformMatrix4x2fv: _glUniformMatrix4x2fv,
          glUniformMatrix4x3fv: _glUniformMatrix4x3fv,
          glUseProgram: _glUseProgram,
          glValidateProgram: _glValidateProgram,
          glVertexAttrib1f: _glVertexAttrib1f,
          glVertexAttrib1fv: _glVertexAttrib1fv,
          glVertexAttrib2f: _glVertexAttrib2f,
          glVertexAttrib2fv: _glVertexAttrib2fv,
          glVertexAttrib3f: _glVertexAttrib3f,
          glVertexAttrib3fv: _glVertexAttrib3fv,
          glVertexAttrib4f: _glVertexAttrib4f,
          glVertexAttrib4fv: _glVertexAttrib4fv,
          glVertexAttribDivisor: _glVertexAttribDivisor,
          glVertexAttribDivisorANGLE: _glVertexAttribDivisorANGLE,
          glVertexAttribDivisorARB: _glVertexAttribDivisorARB,
          glVertexAttribDivisorEXT: _glVertexAttribDivisorEXT,
          glVertexAttribDivisorNV: _glVertexAttribDivisorNV,
          glVertexAttribI4i: _glVertexAttribI4i,
          glVertexAttribI4iv: _glVertexAttribI4iv,
          glVertexAttribI4ui: _glVertexAttribI4ui,
          glVertexAttribI4uiv: _glVertexAttribI4uiv,
          glVertexAttribIPointer: _glVertexAttribIPointer,
          glVertexAttribPointer: _glVertexAttribPointer,
          glVertexPointer: _glVertexPointer,
          glViewport: _glViewport,
          glWaitSync: _glWaitSync,
          invoke_v,
          invoke_vd,
          invoke_vi,
          invoke_vii,
          llvm_eh_typeid_for: _llvm_eh_typeid_for,
          proc_exit: _proc_exit,
          random_get: _random_get,
          setNetworkCallback: _setNetworkCallback,
          setprotoent: _setprotoent,
          stackAlloc: _stackAlloc,
          stackRestore: _stackRestore,
          stackSave: _stackSave,
          strptime: _strptime,
          strptime_l: _strptime_l
        };
        function invoke_v(e) {
          var r = stackSave();
          try {
            getWasmTableEntry(e)();
          } catch (t) {
            stackRestore(r);
            if (t !== t + 0) {
              throw t;
            }
            _setThrew(1, 0);
          }
        }
        function invoke_vd(e, r) {
          var t = stackSave();
          try {
            getWasmTableEntry(e)(r);
          } catch (n) {
            stackRestore(t);
            if (n !== n + 0) {
              throw n;
            }
            _setThrew(1, 0);
          }
        }
        function invoke_vii(e, r, t) {
          var n = stackSave();
          try {
            getWasmTableEntry(e)(r, t);
          } catch (a) {
            stackRestore(n);
            if (a !== a + 0) {
              throw a;
            }
            _setThrew(1, 0);
          }
        }
        function invoke_vi(e, r) {
          var t = stackSave();
          try {
            getWasmTableEntry(e)(r);
          } catch (n) {
            stackRestore(t);
            if (n !== n + 0) {
              throw n;
            }
            _setThrew(1, 0);
          }
        }
        function callMain(e = []) {
          var r = resolveGlobalSymbol("main").sym;
          if (r) {
            e.unshift(thisProgram);
            var t = e.length;
            var n = stackAlloc((t + 1) * 4);
            var a = n;
            for (var o of e) {
              HEAPU32[a >> 2] = stringToUTF8OnStack(o);
              a += 4;
            }
            HEAPU32[a >> 2] = 0;
            try {
              var l = r(t, n);
              exitJS(l, true);
              return l;
            } catch (c) {
              return handleException(c);
            }
          }
        }
        function run(e = arguments_) {
          if (runDependencies > 0) {
            dependenciesFulfilled = run;
            return;
          }
          preRun();
          if (runDependencies > 0) {
            dependenciesFulfilled = run;
            return;
          }
          function r() {
            Module.calledRun = true;
            if (!ABORT) {
              initRuntime();
              preMain();
              readyPromiseResolve?.(Module);
              Module.onRuntimeInitialized?.();
              var t = Module.noInitialRun || false;
              if (!t) {
                callMain(e);
              }
              postRun();
            }
          }
          if (Module.setStatus) {
            Module.setStatus("Running...");
            setTimeout(() => {
              setTimeout(() => Module.setStatus(""), 1);
              r();
            }, 1);
          } else {
            r();
          }
        }
        var wasmExports;
        wasmExports = await createWasm();
        return {
          Module,
          FS,
          SOCKFS,
          DNS,
          HEAPU32,
          HEAP32,
          HEAP16,
          HEAP8,
          HEAPU8,
          getValue,
          addFunction,
          removeFunction,
          setValue,
          writeArrayToMemory,
          intArrayFromString,
          writeSockaddr,
          readSockaddr,
          AsciiToString,
          _malloc,
          addRunDependency,
          removeRunDependency,
          start: () => {
            run();
            if (runtimeInitialized) {
              moduleRtn = Module;
            } else {
              moduleRtn = new Promise((e, r) => {
                readyPromiseResolve = e;
                readyPromiseReject = r;
              });
            }
          }
        };
      };
    })();
    ir = Mr;
  });
  function sr(e) {
    let r = e?.Module.ccall("getErrnoLocation", "number", [], []);
    if (r) {
      return e.getValue(r, "i32");
    } else {
      return 0;
    }
  }
  var Ge;
  var Ve = pe(() => {
    ar();
    We();
    Ge = class {
      get exited() {
        return this._exited;
      }
      set exited(r) {
        this._exited = r;
      }
      get running() {
        return this._running;
      }
      set running(r) {
        this._running = r;
      }
      constructor(r = {}) {
        this._exited = false;
        this.waitLogs = [];
        this.waitTimers = new Set();
        this._running = false;
        this.opts = r;
      }
      Cmd_ExecuteString(r) {
        this.em?.Module?.ccall("Cmd_ExecuteString", null, ["string"], [r]);
      }
      Sys_Quit() {
        this.Cmd_ExecuteString("quit");
      }
      async init() {
        this.emPromise ||= this.runEm();
        await this.emPromise;
        if (this.exited) {
          this.Sys_Quit();
          return;
        }
      }
      main() {
        if (!!this.em && !this.running && !this.exited) {
          this.running = true;
          this.em.start();
        }
      }
      quit() {
        this.waitTimers.forEach(r => {
          clearInterval(r);
        });
        if (!this.exited && !!this.running) {
          this.exited = true;
          this.running = false;
          this.Sys_Quit();
        }
      }
      locateFile(r) {
        return this.opts.filesMap[r] ?? r;
      }
      initRender(r = "gl4es") {
        switch (r) {
          case "gl4es":
          case "gles3compat":
            if (this.opts?.libraries?.render?.gles3compat) {
              this.opts.filesMap[Me] = this.opts.libraries.render.gles3compat;
            }
            if (this.opts?.libraries?.render?.gl4es) {
              this.opts.filesMap[nr] = this.opts.libraries.render.gl4es;
            }
            this.opts.dynamicLibraries.push(Me);
            return ["-ref", "webgl2", ...(this.opts.arguments || [])];
          default:
            if (this.opts?.libraries?.render?.soft) {
              this.opts.filesMap[He] = this.opts.libraries.render.soft;
            }
            this.opts.dynamicLibraries.push(He);
            return ["-ref", "soft", ...(this.opts.arguments || [])];
        }
      }
      initLibrary(r, t) {
        if (this.opts.libraries?.[r]) {
          this.opts.filesMap[t] = this.opts.libraries[r];
        }
      }
      async getCVar(r, t = 1000) {
        let n = await this.waitLog(`"${r}" is`, r, t);
        let a = `"${r}" is "`;
        let o = n.indexOf(a);
        if (o === -1) {
          return "";
        }
        let l = o + a.length;
        let c = n.indexOf("\"", l);
        if (c === -1) {
          return "";
        } else {
          return n.slice(l, c);
        }
      }
      waitLog(r, t, n = 1000) {
        return new Promise((a, o) => {
          this.waitLogs.push({
            subLog: r,
            resolve: a,
            reject: o,
            timeoutMs: n,
            createdAt: Date.now()
          });
          if (t) {
            this.Cmd_ExecuteString(t);
          }
        });
      }
      invokeWaitLogs(r) {
        let t = Date.now();
        this.waitLogs = this.waitLogs.filter(n => r.includes(n.subLog) ? (n.resolve(r), false) : t - n.createdAt > n.timeoutMs ? (n.reject(new Error("timeout")), false) : true);
      }
      async runEm() {
        this.opts.filesMap ||= {};
        this.opts.dynamicLibraries ||= [];
        this.opts.arguments ||= [];
        this.initLibrary("filesystem", Ue);
        this.initLibrary("client", Oe);
        this.initLibrary("server", Ne);
        this.initLibrary("menu", Re);
        if (this.opts.libraries?.xash) {
          this.opts.filesMap[tr] = this.opts.libraries.xash;
        }
        let r = this.opts?.canvas;
        let t = this.initRender(this.opts.renderer);
        let n = [Ue, Re, Ne, Oe, ...this.opts.dynamicLibraries];
        this.em = await ir({
          canvas: r,
          dynamicLibraries: n,
          net: this.net,
          locateFile: a => this.locateFile(a),
          arguments: t,
          ...(this.opts.module ?? {}),
          print: a => {
            this.invokeWaitLogs(a);
            this.opts.module?.print?.(a);
          },
          printErr: a => {
            this.invokeWaitLogs(a);
            this.opts.module?.printErr?.(a);
          }
        });
        if (this.net) {
          this.net.init(this.em);
        }
        this.em.FS.mkdir("/rwdir");
      }
    };
  });
  var or = pe(() => {});
  var Pe;
  var lr = pe(() => {
    Pe = class {
      constructor(r) {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
        this.opts = r;
        this.buffer = new Array(this.opts.maxSize);
      }
      push(r) {
        if (this.isFull()) {
          this.tail = (this.tail + 1) % this.opts.maxSize;
        } else {
          this.count += 1;
        }
        this.buffer[this.head] = r;
        this.head = (this.head + 1) % this.opts.maxSize;
      }
      enqueue(r) {
        this.push(r);
      }
      pull() {
        if (this.isEmpty()) {
          return;
        }
        let r = this.buffer[this.tail];
        this.buffer[this.tail] = undefined;
        this.tail = (this.tail + 1) % this.opts.maxSize;
        this.count -= 1;
        return r;
      }
      peek() {
        return this.buffer[this.tail];
      }
      size() {
        return this.count;
      }
      isFull() {
        return this.count === this.opts.maxSize;
      }
      isEmpty() {
        return this.count === 0;
      }
      clear() {
        this.buffer.fill(undefined);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
      }
      toArray() {
        let r = new Array(this.size());
        for (let t = 0; t < this.size(); ++t) {
          let n = (this.tail + t) % this.opts.maxSize;
          r[t] = this.buffer[n];
        }
        return r;
      }
    };
  });
  var cr = pe(() => {
    or();
    lr();
  });
  var Te;
  var _r = pe(() => {
    cr();
    Ve();
    Te = class {
      constructor(r, t = {}) {
        this.lastSocketID = 1000;
        this.sockets = new Map();
        let {
          maxPackets: n = 128,
          hostname: a = "webxash3d",
          hostID: o = 3000
        } = t;
        this.sender = r;
        this.opts = {
          hostname: a,
          maxPackets: n,
          hostID: o
        };
        this.incoming = new Pe({
          maxSize: n
        });
      }
      init(r) {
        this.em ||= r;
      }
      readSockaddrFast(r) {
        let n = this.em.HEAPU8;
        let a = r + 4;
        let o = [n[a], n[a + 1], n[a + 2], n[a + 3]];
        let l = r + 2;
        let c = n[l] << 8 | n[l + 1];
        return [o, c];
      }
      recvfrom(r, t, n, a, o, l) {
        let c = this.incoming.pull();
        if (!c) {
          this.em.setValue(sr(this.em), 73, "i32");
          return -1;
        }
        let _ = this.em;
        let u = c.data;
        let m = u instanceof Uint8Array ? u : new Uint8Array(u.buffer || u);
        let f = Math.min(n, m.length);
        if (f > 0) {
          _.HEAPU8.set(m.subarray(0, f), t);
        }
        if (o) {
          let v = _.HEAP8;
          let g = _.HEAP16;
          let h = o >> 1;
          let p = c.port;
          g[h] = 2;
          v[o + 2] = p >> 8 & 255;
          v[o + 3] = p & 255;
          v[o + 4] = c.ip[0];
          v[o + 5] = c.ip[1];
          v[o + 6] = c.ip[2];
          v[o + 7] = c.ip[3];
        }
        if (l) {
          _.HEAP32[l >> 2] = 16;
        }
        return f;
      }
      sendto(r, t, n, a, o, l) {
        let _ = this.em.HEAPU8;
        let [u, m] = this.readSockaddrFast(o);
        let f = _.subarray(t, t + n);
        this.sender.sendto({
          data: f,
          ip: u,
          port: m
        });
        return n;
      }
      sendtoBatch(r, t, n, a, o, l, c) {
        let _ = this.em;
        let u = _.HEAP32;
        let m = _.HEAPU8;
        let f = 0;
        let [v, g] = this.readSockaddrFast(l);
        for (let h = 0; h < a; ++h) {
          let p = u[(n >> 2) + h];
          let b = u[(t >> 2) + h];
          let S = m.subarray(b, b + p);
          this.sender.sendto({
            data: S,
            port: g,
            ip: v
          });
          f += S.length;
        }
        return f;
      }
      socket(r, t, n) {
        let a = this.lastSocketID;
        this.sockets.set(a, {
          id: a,
          family: r,
          type: t,
          protocol: n
        });
        this.lastSocketID += 1;
        return a;
      }
      gethostbyname(r) {
        return 0;
      }
      gethostname(r, t) {
        this.em.writeArrayToMemory(this.em.intArrayFromString(`${this.opts.hostname}.${this.opts.hostID}`, true), r);
        return 0;
      }
      getsockname(r, t, n) {
        let a = this.sockets.get(r);
        if (a) {
          this.em.writeSockaddr(t, a.family, a.addr?.addr ?? "0.0.0.0", a.addr?.port ?? 0, n);
          return 0;
        } else {
          return -1;
        }
      }
      bind(r, t, n) {
        let a = this.sockets.get(r);
        if (a) {
          a.addr = this.em.readSockaddr(t, n);
          return 0;
        } else {
          return -1;
        }
      }
      closesocket(r) {
        if (this.sockets.delete(r)) {
          return 0;
        } else {
          return -1;
        }
      }
      getaddrinfo(r, t, n, a) {
        let o = this.em.AsciiToString(r);
        let [, l] = o.split(".", 2);
        let c = Number(l);
        let _ = this.em._malloc(16);
        this.em.writeSockaddr(_, 2, `101.101.${c >> 0 & 255}.${c >> 8 & 255}`, 0);
        let u = this.em._malloc(32);
        this.em.HEAP32[u + 4 >> 2] = 2;
        this.em.HEAP32[u + 8 >> 2] = 2;
        this.em.HEAP32[u + 12 >> 2] = 17;
        this.em.HEAPU32[u + 24 >> 2] = 0;
        this.em.HEAPU32[u + 20 >> 2] = _;
        this.em.HEAP32[u + 16 >> 2] = 16;
        this.em.HEAP32[u + 28 >> 2] = 0;
        this.em.HEAPU32[a >> 2] = u;
        return 0;
      }
    };
  });
  var ur = pe(() => {});
  var fr = pe(() => {
    _r();
    ur();
  });
  var mr = pe(() => {
    We();
    Ve();
    fr();
  });
  var ct = $e(() => {
    var Ye = Ur(rr());
    mr();
    var Le = new URLSearchParams(location.search);
    var Hr = "wss://tfc.akuji.org/relay";
    var ve = Le.has("debug");
    var Rr = "tfc-assets-v1";
    var je = document.getElementById("status");
    var Or = document.getElementById("bar");
    var Nr = document.getElementById("pct");
    function xe(e) {
      je.textContent = e;
    }
    function Ar(e) {
      je.textContent = e;
      je.classList.add("err");
    }
    function Fe(e) {
      Or.style.width = e + "%";
      Nr.textContent = Math.floor(e) + "%";
    }
    window.alert = e => console.warn("[xash alert]", e);
    window.addEventListener("error", e => Ar("failed to load — reload to retry"));
    (() => {
      let e = [];
      for (let t of ["AudioContext", "webkitAudioContext"]) {
        let n = window[t];
        if (!n) {
          continue;
        }
        let a = function (...o) {
          let l = new n(...o);
          e.push(l);
          return l;
        };
        a.prototype = n.prototype;
        window[t] = a;
      }
      let r = () => e.forEach(t => {
        if (t.state === "suspended") {
          t.resume().catch(() => {});
        }
      });
      for (let t of ["pointerdown", "keydown", "touchstart"]) {
        window.addEventListener(t, r, {
          capture: true
        });
      }
    })();
    var we = [];
    var yr = 0;
    var Qe = () => Date.now() - yr < 3000;
    var De = {
      3: "MOUSE4",
      4: "MOUSE5"
    };
    var Wr = {
      MOUSE4: "+gren1",
      MOUSE5: "+gren2"
    };
    var Xe = {
      ...Wr
    };
    var gr = 0;
    function pr(e, r) {
      let t = Date.now();
      if (!r && t - gr < 2000) {
        return;
      }
      gr = t;
      let n;
      try {
        n = new TextDecoder().decode(e.em.FS.readFile("/rodir/tfc/config.cfg"));
      } catch {
        return;
      }
      for (let a of Object.values(De)) {
        let o = n.match(new RegExp(`^\\s*bind\\s+"${a}"\\s+"([^"]*)"`, "mi"));
        if (o) {
          Xe[a] = o[1];
        }
      }
    }
    function Vr(e) {
      pr(e, true);
      for (let [n, a] of Object.entries(Xe)) {
        try {
          e.Cmd_ExecuteString(`bind ${n} "${a}"`);
        } catch {}
      }
      let r = new Set();
      let t = (n, a) => {
        let o = Xe[n];
        if (o) {
          if (o.startsWith("+")) {
            e.Cmd_ExecuteString((a ? "+" : "-") + o.slice(1));
          } else if (a) {
            e.Cmd_ExecuteString(o);
          }
        }
      };
      window.addEventListener("mousedown", n => {
        let a = De[n.button];
        if (a) {
          n.preventDefault();
          pr(e);
          r.add(a);
          t(a, true);
        }
      }, {
        capture: true
      });
      window.addEventListener("mouseup", n => {
        let a = De[n.button];
        if (a) {
          n.preventDefault();
          if (r.delete(a)) {
            t(a, false);
          }
        }
      }, {
        capture: true
      });
      window.addEventListener("auxclick", n => {
        if (De[n.button]) {
          n.preventDefault();
        }
      }, {
        capture: true
      });
      window.addEventListener("blur", () => {
        for (let n of r) {
          t(n, false);
        }
        r.clear();
      });
    }
    function wr() {
      let e = Le.get("touch");
      if (e === "1") {
        return true;
      } else if (e === "0") {
        return false;
      } else {
        return navigator.maxTouchPoints > 0 && window.matchMedia("(hover: none)").matches;
      }
    }
    var zr = 0.02;
    var Ae = 0.125;
    var dr = "tfcweb_touch.cfg";
    var jr = [["attack", "attack", "+attack", 0.02, 0.02, 0.3], ["jump", "jump", "+jump", 0.34, 0.02, 0.24], ["duck", "crouch", "+duck", 0.6, 0.02, 0.24], ["attack2", "attack2", "+attack2", 0.02, 0.34, 0.2], ["reload", "reload", "+reload", 0.24, 0.34, 0.2], ["grenade2", "grenade2", "+gren2", 0.02, 0.56, 0.18], ["grenade", "grenade", "+gren1", 0.22, 0.56, 0.18]];
    var Qr = [["slot1", "slot1", "slot1"], ["slot2", "slot2", "slot2"], ["slot3", "slot3", "slot3"], ["slot4", "slot4", "slot4"], ["slot5", "slot5", "slot5"]];
    var Xr = [["menu", "menu", "escape"], ["scores", "score", "+showscores"], ["chat", "", "messagemode", "kb-chat"], ["chat_team", "", "messagemode2", "kb-chat-team"], ["change_class", "changeclass", "changeclass"], ["change_team", "changeteam", "changeteam"], ["commandmenu", "cmd_menu", "+commandmenu"], ["use", "use", "+use"]];
    function qr(e, r, t, n, a) {
      if (!e) {
        return;
      }
      let o = document.getElementById("canvas").getBoundingClientRect();
      e.style.left = o.left + r * o.width + "px";
      e.style.top = o.top + t * o.height + "px";
      e.style.width = (n - r) * o.width + "px";
      e.style.height = (a - t) * o.height + "px";
      e.style.fontSize = (a - t) * o.height * 0.5 + "px";
    }
    var Lr = "";
    function vr(e) {
      let r = document.getElementById("canvas");
      let t = r.width || r.clientWidth || window.innerWidth;
      let n = r.height || r.clientHeight || window.innerHeight;
      Lr = t + "x" + n;
      let a = Math.max(1, t / n);
      let o = Math.min(1, a / 2.2);
      let l = g => g * o;
      let c = g => g * o / a;
      let _ = zr;
      let u = [`touch_aspectratio ${(n / t).toFixed(6)}`, "touch_removeall"];
      let m = (g, h, p, b, S, w, A) => u.push(`touch_addbutton "${g}" "${h}" "${p}" ${[b, S, w, A].map(k => k.toFixed(4)).join(" ")} 255 255 255 160 0`);
      let f = l(_ + Ae);
      let v = f + l(_);
      m("move", "", "_move", 0, v, 0.5, 1);
      m("look", "", "_look", 0.5, v, 1, 1);
      Qr.forEach(([g, h, p], b) => {
        let S = c(_ + b * (Ae + _));
        m(g, "touch/gfx/" + h, p, S, l(_), S + c(Ae), f);
      });
      Xr.forEach(([g, h, p, b], S) => {
        let w = 1 - c(_ + S * (Ae + _));
        let A = w - c(Ae);
        if (b) {
          qr(document.getElementById(b), A, l(_), w, f);
        } else {
          m(g, "touch/gfx/" + h, p, A, l(_), w, f);
        }
      });
      for (let [g, h, p, b, S, w] of jr) {
        let A = 1 - c(b);
        let k = 1 - l(S);
        m(g, "touch/gfx/" + h, p, A - c(w), k - l(w), A, k);
      }
      try {
        e.em.FS.writeFile("/rodir/tfc/" + dr, `${u.join(`
`)}
`);
        u.unshift("touch_config_file \"" + dr + "\"");
      } catch (g) {
        console.warn("touch config write failed:", g);
      }
      xr(e, u);
    }
    function xr(e, r) {
      for (let t of r) {
        try {
          e.Cmd_ExecuteString(t);
        } catch (n) {
          console.warn("touch cmd failed:", t, n);
        }
      }
    }
    async function Yr(e) {
      try {
        let r = await Ye.default.loadAsync(e.em.FS.readFile("/rodir/tfc/extras.pk3"));
        for (let [t, n] of [["kb-chat", "chat"], ["kb-chat-team", "chat_team"]]) {
          let a = document.getElementById(t);
          let o = r.file(`touch/gfx/${n}.png`);
          if (!a || !o) {
            continue;
          }
          let l = new Blob([await o.async("uint8array")], {
            type: "image/png"
          });
          a.style.backgroundImage = `url(${URL.createObjectURL(l)})`;
          a.textContent = "";
        }
      } catch (r) {
        console.warn("chat icons unavailable, using glyphs:", r);
      }
    }
    function Jr(e) {
      xr(e, ["touch_enable 1", "osk_enable 0", "con_fontscale 1.8"]);
      vr(e);
      Yr(e);
      let r = false;
      setInterval(() => {
        let t = document.getElementById("canvas");
        let n = Qe();
        if ((t.width || t.clientWidth) + "x" + (t.height || t.clientHeight) !== Lr || n && !r) {
          vr(e);
        }
        r = n;
      }, 1000);
    }
    var Kr = {
      ",": "Comma",
      ".": "Period",
      "-": "Minus",
      "'": "Quote",
      " ": "Space"
    };
    var hr = {
      ",": 188,
      ".": 190,
      "-": 189,
      "'": 222,
      " ": 32
    };
    var Er = {
      1: "!",
      2: "@",
      3: "#",
      4: "$",
      5: "%",
      6: "^",
      7: "&",
      8: "*",
      9: "(",
      0: ")",
      "-": "_",
      "'": "\"",
      ",": "<",
      ".": ">"
    };
    var Zr = e => Kr[e] || (e >= "0" && e <= "9" ? "Digit" + e : "Key" + e.toUpperCase());
    var $r = e => hr[e] !== undefined ? hr[e] : e.toUpperCase().charCodeAt(0);
    var et = [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", {
      id: "backspace",
      label: "⌫",
      key: "Backspace",
      keyCode: 8,
      w: 1.6
    }], ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], [{
      id: "tab",
      label: "⇥",
      key: "Tab",
      keyCode: 9,
      w: 1.4
    }, "a", "s", "d", "f", "g", "h", "j", "k", "l", {
      id: "enter",
      label: "⏎",
      key: "Enter",
      keyCode: 13,
      w: 1.9,
      accent: true
    }], [{
      id: "shift",
      label: "⇧",
      w: 1.6,
      sticky: true
    }, "z", "x", "c", "v", "b", "n", "m", ",", "."], [{
      id: "esc",
      label: "ESC",
      key: "Escape",
      keyCode: 27,
      w: 1.7,
      small: true
    }, "-", "'", {
      id: "space",
      label: "␣",
      char: " ",
      w: 5
    }, {
      id: "hide",
      label: "✕",
      w: 1.7,
      small: true
    }]];
    var rt = `
#kb-toggle {
    position: fixed; z-index: 30;
    /* landscape on a notched iPhone puts the notch over this corner */
    top: calc(10px + env(safe-area-inset-top));
    right: calc(10px + env(safe-area-inset-right));
    width: 46px; height: 46px; display: none;
    align-items: center; justify-content: center;
    font-size: 22px; line-height: 1; color: #e9e2cd;
    background: rgba(12,12,10,0.55); border: 1px solid rgba(216,179,74,0.55);
    border-radius: 8px; -webkit-tap-highlight-color: transparent;
    touch-action: manipulation; user-select: none; cursor: pointer;
}
#kb-toggle.on { display: flex; }
#kb-toggle.active { background: rgba(216,179,74,0.85); color: #14120c; }
/* Chat keys: sized and placed by applyTouchLayout so they land in the engine's
   own top strip, and styled to read as part of it. */
.kb-chat {
    position: fixed; z-index: 29; display: none;
    align-items: center; justify-content: center;
    line-height: 1;
    /* 160/255, the alpha the engine draws its own touch buttons at */
    opacity: 0.63;
    background: center / contain no-repeat;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation; user-select: none; cursor: pointer;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
.kb-chat.on { display: flex; }
.kb-chat:active { opacity: 1; }
#kb {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    display: none; padding: 6px 5px calc(6px + env(safe-area-inset-bottom));
    background: rgba(10,10,8,0.88); border-top: 1px solid rgba(216,179,74,0.45);
    touch-action: none; user-select: none; -webkit-user-select: none;
}
#kb.open { display: block; }
/* The keyboard hides the game's own text field, so mirror what's typed. */
#kb-preview {
    display: flex; align-items: center;
    height: 38px; margin-bottom: 6px; padding: 0 10px;
    background: #fff; color: #14120c;
    border-radius: 6px; overflow-x: hidden; white-space: nowrap;
    font-family: system-ui, "Segoe UI", Roboto, sans-serif; font-size: 18px;
}
#kb-preview span { flex: none; }
#kb-preview.empty { color: rgba(20,18,12,0.38); }
#kb-caret {
    flex: none; width: 2px; height: 21px; margin-left: 1px;
    background: #14120c; animation: kb-blink 1s steps(1) infinite;
}
#kb-preview.empty #kb-caret { display: none; }
@keyframes kb-blink { 50% { opacity: 0; } }
.kb-row { display: flex; gap: 5px; margin-bottom: 5px; }
.kb-row:last-child { margin-bottom: 0; }
.kb-key {
    flex: 1 1 0; min-width: 0; height: 44px;
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, "Segoe UI", Roboto, sans-serif;
    font-size: 19px; line-height: 1; color: #e9e2cd;
    background: rgba(52,50,44,0.92); border: 1px solid rgba(255,255,255,0.14);
    border-radius: 6px; -webkit-tap-highlight-color: transparent;
}
.kb-key.small { font-size: 13px; letter-spacing: 0.06em; }
.kb-key.accent { background: rgba(216,179,74,0.9); color: #14120c; border-color: rgba(216,179,74,0.9); }
.kb-key.down { background: rgba(216,179,74,0.95); color: #14120c; }
.kb-key.held { background: rgba(216,179,74,0.4); border-color: rgba(216,179,74,0.9); }
@media (max-height: 420px) {
    .kb-key { height: 36px; font-size: 17px; }
    #kb-preview { height: 32px; font-size: 16px; margin-bottom: 5px; }
    #kb-caret { height: 18px; }
}
`;
    function ze(e, r) {
      let t = new KeyboardEvent(e, {
        bubbles: true,
        cancelable: true,
        composed: true,
        ...r
      });
      for (let n of ["keyCode", "charCode", "which"]) {
        if (r[n] !== undefined && t[n] !== r[n]) {
          try {
            Object.defineProperty(t, n, {
              get: () => r[n]
            });
          } catch {}
        }
      }
      document.body.dispatchEvent(t);
    }
    function br({
      key: e,
      code: r,
      keyCode: t,
      text: n,
      shift: a
    }) {
      let o = {
        shiftKey: !!a
      };
      ze("keydown", {
        key: e,
        code: r,
        keyCode: t,
        which: t,
        charCode: 0,
        ...o
      });
      if (n) {
        let l = n.charCodeAt(0);
        ze("keypress", {
          key: n,
          code: r,
          keyCode: l,
          which: l,
          charCode: l,
          ...o
        });
      }
      ze("keyup", {
        key: e,
        code: r,
        keyCode: t,
        which: t,
        charCode: 0,
        ...o
      });
    }
    function tt(e) {
      let r = document.createElement("style");
      r.textContent = rt;
      document.head.appendChild(r);
      let t = document.createElement("div");
      t.id = "kb-toggle";
      t.className = "on";
      t.textContent = "⌨";
      t.setAttribute("role", "button");
      t.setAttribute("aria-label", "Toggle keyboard");
      let n = document.createElement("div");
      n.id = "kb";
      let a = false;
      let o = [];
      let l = document.createElement("div");
      l.id = "kb-preview";
      let c = document.createElement("span");
      let _ = document.createElement("span");
      _.id = "kb-caret";
      l.append(c, _);
      n.appendChild(l);
      let u = "";
      let m = () => {
        l.classList.toggle("empty", u === "");
        c.textContent = u || "type here…";
        l.scrollLeft = l.scrollWidth;
      };
      m();
      let f = p => {
        a = p;
        for (let {
          el: S,
          ch: w
        } of o) {
          S.textContent = a ? Er[w] || w.toUpperCase() : w;
        }
        let b = n.querySelector("[data-id=\"shift\"]");
        if (b) {
          b.classList.toggle("held", a);
        }
      };
      let v = () => {
        n.classList.add("open");
        t.classList.add("active");
        u = "";
        m();
      };
      let g = () => {
        n.classList.remove("open");
        t.classList.remove("active");
        f(false);
        u = "";
        m();
      };
      for (let p of et) {
        let b = document.createElement("div");
        b.className = "kb-row";
        for (let S of p) {
          let w = typeof S == "string";
          let A = document.createElement("div");
          A.className = "kb-key" + (!w && S.small ? " small" : "") + (!w && S.accent ? " accent" : "");
          A.textContent = w ? S : S.label;
          if (!w) {
            A.dataset.id = S.id;
            if (S.w) {
              A.style.flexGrow = String(S.w);
            }
          }
          if (w) {
            o.push({
              el: A,
              ch: S
            });
          }
          A.addEventListener("pointerdown", G => {
            G.preventDefault();
            G.stopPropagation();
            if (!w && S.sticky) {
              f(!a);
              return;
            }
            if (!w && S.id === "hide") {
              g();
              return;
            }
            A.classList.add("down");
            let D = w ? S : S.char;
            if (D) {
              let F = a ? Er[D] || D.toUpperCase() : D;
              br({
                key: F,
                code: Zr(D),
                keyCode: $r(D),
                text: F,
                shift: a
              });
              if (a) {
                f(false);
              }
              u += F;
            } else {
              br({
                key: S.key,
                code: S.key,
                keyCode: S.keyCode
              });
              if (S.id === "backspace") {
                u = u.slice(0, -1);
              } else {
                u = "";
              }
              if (S.id === "enter" && Qe()) {
                setTimeout(g, 0);
              }
            }
            m();
          });
          let k = () => A.classList.remove("down");
          A.addEventListener("pointerup", k);
          A.addEventListener("pointercancel", k);
          A.addEventListener("pointerleave", k);
          b.appendChild(A);
        }
        n.appendChild(b);
      }
      for (let p of ["touchstart", "touchmove", "touchend"]) {
        n.addEventListener(p, b => b.preventDefault(), {
          passive: false
        });
      }
      t.addEventListener("pointerdown", p => {
        p.preventDefault();
        p.stopPropagation();
        if (n.classList.contains("open")) {
          g();
        } else {
          v();
        }
      });
      let h = [["kb-chat", "💬", "messagemode", "Say"], ["kb-chat-team", "👥", "messagemode2", "Say to team"]].map(([p, b, S, w]) => {
        let A = document.createElement("div");
        A.id = p;
        A.className = "kb-chat";
        A.textContent = b;
        A.setAttribute("role", "button");
        A.setAttribute("aria-label", w);
        A.addEventListener("pointerdown", k => {
          k.preventDefault();
          k.stopPropagation();
          try {
            e.Cmd_ExecuteString(S);
          } catch {}
          v();
        });
        document.body.appendChild(A);
        return A;
      });
      document.body.appendChild(t);
      document.body.appendChild(n);
      setInterval(() => {
        let p = Qe();
        t.classList.toggle("on", !p);
        for (let b of h) {
          b.classList.toggle("on", p);
        }
      }, 500);
    }
    function ye() {
      let e = document.getElementById("canvas");
      let r = window.visualViewport;
      let t = Math.round(r ? r.width : window.innerWidth);
      let n = Math.round(r ? r.height : window.innerHeight);
      e.style.width = t + "px";
      e.style.height = n + "px";
    }
    function nt() {
      ye();
      let e = () => {
        ye();
        setTimeout(ye, 300);
      };
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", ye);
        window.visualViewport.addEventListener("scroll", ye);
      }
      window.addEventListener("orientationchange", e);
    }
    var qe = class extends Ge {
      constructor(r) {
        super(r);
        this.net = new Te(this);
        this.ws = null;
      }
      startTransport() {
        return new Promise((r, t) => {
          let n = new WebSocket(Hr);
          n.binaryType = "arraybuffer";
          n.onopen = () => {
            this.ws = n;
            r();
          };
          n.onerror = () => t(new Error("relay connection failed"));
          n.onmessage = a => {
            let o = new Uint8Array(a.data);
            if (!(o.length < 7)) {
              if (ve) {
                let l = String.fromCharCode(o[10] || 0);
                console.log(`[net in] ${o[0]}.${o[1]}.${o[2]}.${o[3]}:${o[4] << 8 | o[5]} ${o.length - 6}B type=${l}`);
              }
              this.net.incoming.enqueue({
                ip: [o[0], o[1], o[2], o[3]],
                port: o[4] << 8 | o[5],
                data: new Int8Array(a.data.slice(6))
              });
            }
          };
          n.onclose = () => {
            if (this.ws) {
              console.warn("relay connection lost");
            }
          };
        });
      }
      sendto(r) {
        let t = r.data;
        let n = new Uint8Array(t.buffer, t.byteOffset, t.length);
        if (ve) {
          console.log(`[net out] ${r.ip.join(".")}:${r.port} ${t.length}B`);
        }
        let a = n[0] === 49 && n[1] === 255 ? 0 : n[0] === 255 && n[1] === 255 && n[2] === 255 && n[3] === 255 && n[4] === 49 && n[5] === 255 ? 4 : -1;
        if (a >= 0) {
          this.answerMasterQuery(r, n.subarray(a));
          return;
        }
        if (r.ip[0] === 101 && r.ip[1] === 101 || (n[0] === 255 && n[1] === 255 && n[2] === 255 && n[3] === 255 || (yr = Date.now()), !this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          return;
        }
        let o = new Uint8Array(6 + t.length);
        o.set(r.ip, 0);
        o[4] = r.port >> 8 & 255;
        o[5] = r.port & 255;
        o.set(n, 6);
        this.ws.send(o);
      }
      answerMasterQuery(r, t) {
        let n = new TextDecoder("latin1").decode(t);
        let a = n.includes("\\clver\\");
        let o = [255, 255, 255, 255, 102, 10];
        if (a) {
          let l = (n.match(/\\key\\([0-9a-fA-F]+)/) || [])[1] || "0";
          let c = parseInt(l, 16) >>> 0;
          o.push(127, c & 255, c >> 8 & 255, c >> 16 & 255, c >> 24 & 255, 0);
        }
        for (let l of we) {
          for (let c of l.ip.split(".").map(Number)) {
            o.push(c);
          }
          o.push(l.port >> 8 & 255, l.port & 255);
        }
        o.push(0, 0, 0, 0, 0, 0);
        this.net.incoming.enqueue({
          ip: r.ip,
          port: r.port,
          data: new Int8Array(o)
        });
      }
    };
    async function Sr(e, r, t, n) {
      let a = await fetch(e);
      if (!a.ok) {
        throw new Error(`${e}: HTTP ${a.status}`);
      }
      let o = +a.headers.get("Content-Length") || 0;
      let l = a.body.getReader();
      let c = [];
      let _ = 0;
      while (true) {
        let {
          done: f,
          value: v
        } = await l.read();
        if (f) {
          break;
        }
        c.push(v);
        _ += v.length;
        if (o) {
          Fe(t + (n - t) * (_ / o));
          xe(`${r} \xB7 ${(_ / 1048576).toFixed(0)} / ${(o / 1048576).toFixed(0)} MB`);
        }
      }
      let u = new Uint8Array(_);
      let m = 0;
      for (let f of c) {
        u.set(f, m);
        m += f.length;
      }
      return u;
    }
    async function it(e) {
      try {
        let r = await caches.open(Rr);
        let t = await r.match(e);
        if (t) {
          xe("reading cached game data");
          Fe(40);
          let a = new Uint8Array(await t.arrayBuffer());
          Fe(48);
          return a;
        }
        let n = await Sr(e, "retrieving game data", 0, 55);
        try {
          await r.put(e, new Response(n.slice().buffer));
        } catch (a) {
          console.warn("cache put failed", a);
        }
        return n;
      } catch {
        return await Sr(e, "retrieving game data", 0, 55);
      }
    }
    async function at() {
      let e = await it("./assets/tfc-assets.zip");
      let r = await Ye.default.loadAsync(e.buffer);
      let t = Object.entries(r.files).filter(([, c]) => !c.dir);
      let n = {};
      let a = 0;
      for (let [c, _] of t) {
        n["/rodir/" + c] = await _.async("uint8array");
        a++;
        if (a % 50 === 0 || a === t.length) {
          Fe(55 + a / t.length * 40);
          xe(`unpacking archive \xB7 ${a} / ${t.length} files`);
        }
      }
      let [o, l] = await Promise.all([fetch("./game/extras.pk3").then(c => c.arrayBuffer()), fetch("./engine/valve-extras.pk3").then(c => c.arrayBuffer())]);
      n["/rodir/tfc/extras.pk3"] = new Uint8Array(o);
      n["/rodir/valve/extras.pk3"] = new Uint8Array(l);
      try {
        let c = localStorage.getItem("tfc-config");
        if (c) {
          n["/rodir/tfc/config.cfg"] = new TextEncoder().encode(c);
        }
      } catch {}
      Fe(100);
      return n;
    }
    function st() {
      return new qe({
        canvas: document.getElementById("canvas"),
        renderer: "gles3compat",
        arguments: ["-windowed", "-game", "tfc"],
        libraries: {
          xash: "./engine/xash.wasm",
          filesystem: "./engine/filesystem_stdio.wasm",
          menu: Le.has("enginemenu") ? "./engine/libmenu.wasm" : "./game/cl_dlls/menu_emscripten_wasm32.wasm",
          client: "./game/cl_dlls/client_emscripten_wasm32.wasm",
          render: {
            gles3compat: "./engine/libref_webgl2.wasm"
          }
        },
        filesMap: {
          "/rodir/filesystem_stdio.wasm": "./engine/filesystem_stdio.wasm"
        },
        module: {
          print: e => {
            if (ve) {
              console.log("[xash]", e);
            }
          },
          printErr: e => {
            if (ve) {
              console.warn("[xash]", e);
            }
          },
          callbacks: {
            serverInfo: (e, r) => {
              if (ve) {
                console.log("[serverInfo]", e, r);
              }
            },
            gameReady: () => {
              if (ve) {
                console.log("[gameReady]");
              }
              if (window.xash) {
                if (wr()) {
                  Jr(window.xash);
                }
                Vr(window.xash);
              }
            }
          },
          dynamicLibraries: ["filesystem_stdio.wasm", "libref_webgl2.wasm", "cl_dlls/menu_emscripten_wasm32.wasm", "cl_dlls/client_emscripten_wasm32.wasm", "/rodir/filesystem_stdio.wasm"]
        }
      });
    }
    function ot(e, r) {
      for (let [t, n] of Object.entries(r)) {
        let a = t.split("/").slice(0, -1).join("/");
        e.em.FS.mkdirTree(a);
        e.em.FS.writeFile(t, n);
      }
      e.em.FS.chdir("/rodir");
    }
    function lt(e) {
      let r = () => {
        try {
          let t = e.em.FS.readFile("/rodir/tfc/config.cfg");
          localStorage.setItem("tfc-config", new TextDecoder().decode(t));
        } catch {}
      };
      setInterval(r, 20000);
      window.addEventListener("beforeunload", r);
    }
    (async () => {
      let e = document.getElementById("overlay");
      try {
        we = await fetch("./servers.json", {
          cache: "no-store"
        }).then(n => n.ok ? n.json() : []).catch(() => []);
        if (we.length) {
          document.getElementById("maps").innerHTML = `<b>${we.length} dedicated servers online</b><br>${we.map(n => n.map).join(" · ")}`;
        }
        let r = await at();
        xe("starting engine");
        let t = window.xash = st();
        await Promise.all([t.init(), t.startTransport()]);
        ot(t, r);
        xe("entering main menu");
        document.getElementById("canvas").style.display = "block";
        if (wr()) {
          nt();
          tt(t);
        }
        t.main();
        lt(t);
        setTimeout(() => {
          e.classList.add("gone");
          setTimeout(() => e.remove(), 700);
        }, 400);
      } catch (r) {
        Ar("failed: " + r.message + " — reload to retry");
        console.error(r);
      }
    })();
  });
  ct();
})();
/*! Bundled license information:

jszip/dist/jszip.min.js:
  (*!
  
  JSZip v3.10.1 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>
  
  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.
  
  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  *)
*/