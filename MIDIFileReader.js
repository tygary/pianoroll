// Generated by CoffeeScript 1.7.1

/*
Original source files are at http://github.com/adamjmurray/MIDIFileReader.js

Copyright (c) 2013, Adam Murray.
http://github.com/adamjmurray
http://compusition.com

All rights reserved.

Redistribution and use of this project in source and binary forms, with or
without modification, are permitted provided that the following conditions
are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in
   the documentation and/or other materials provided with the
   distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var MIDIFileReader, NodeFileStream, filepath, midi;

MIDIFileReader = (function() {
  var CHANNEL_AFTERTOUCH, CHANNEL_PREFIX, CONTROLLER, COPYRIGHT, CUE_POINT, END_OF_TRACK, HEADER_CHUNK_ID, HEADER_CHUNK_SIZE, INSTRUMENT_NAME, KEY_SIGNATURE, KEY_VALUE_TO_NAME, LYRICS, MARKER, META_EVENT, MICROSECONDS_PER_MINUTE, NOTE_AFTERTOUCH, NOTE_OFF, NOTE_ON, PITCH_BEND, PROGRAM_CHANGE, SEQ_NAME, SEQ_NUMBER, SEQ_SPECIFIC, SMPTE_OFFSET, SYSEX_CHUNK, SYSEX_EVENT, TEMPO, TEXT, TIME_SIGNATURE, TRACK_CHUNK_ID;

  HEADER_CHUNK_ID = 0x4D546864;

  HEADER_CHUNK_SIZE = 0x06;

  TRACK_CHUNK_ID = 0x4D54726B;

  MICROSECONDS_PER_MINUTE = 60000000;

  META_EVENT = 0xFF;

  SYSEX_EVENT = 0xF0;

  SYSEX_CHUNK = 0xF7;

  SEQ_NUMBER = 0x00;

  TEXT = 0x01;

  COPYRIGHT = 0x02;

  SEQ_NAME = 0x03;

  INSTRUMENT_NAME = 0x04;

  LYRICS = 0x05;

  MARKER = 0x06;

  CUE_POINT = 0x07;

  CHANNEL_PREFIX = 0x20;

  END_OF_TRACK = 0x2F;

  TEMPO = 0x51;

  SMPTE_OFFSET = 0x54;

  TIME_SIGNATURE = 0x58;

  KEY_SIGNATURE = 0x59;

  SEQ_SPECIFIC = 0x7F;

  NOTE_OFF = 0x80;

  NOTE_ON = 0x90;

  NOTE_AFTERTOUCH = 0xA0;

  CONTROLLER = 0xB0;

  PROGRAM_CHANGE = 0xC0;

  CHANNEL_AFTERTOUCH = 0xD0;

  PITCH_BEND = 0xE0;

  KEY_VALUE_TO_NAME = {
    0: 'C',
    1: 'G',
    2: 'D',
    3: 'A',
    4: 'E',
    5: 'B',
    6: 'F#',
    7: 'C#',
    '-1': 'F',
    '-2': 'Bb',
    '-3': 'Eb',
    '-4': 'Ab',
    '-5': 'Db',
    '-6': 'Gb',
    '-7': 'Cb'
  };

  function MIDIFileReader(stream) {
    this.stream = stream;
  }

  MIDIFileReader.prototype.read = function(callback) {
    this.stream.open((function(_this) {
      return function() {
        var trackNumber;
        if (_this.stream.uInt32BE() !== HEADER_CHUNK_ID) {
          throw 'Invalid MIDI file: Missing header chuck ID';
        }
        if (_this.stream.uInt32BE() !== HEADER_CHUNK_SIZE) {
          throw 'Invalid MIDI file: Missing header chuck size';
        }
        _this.formatType = _this.stream.uInt16BE();
        _this.numTracks = _this.stream.uInt16BE();
        _this.timeDiv = _this.stream.uInt16BE();
        _this.tracks = (function() {
          var _i, _ref, _results;
          _results = [];
          for (trackNumber = _i = 1, _ref = this.numTracks; _i <= _ref; trackNumber = _i += 1) {
            _results.push(this._readTrack(trackNumber));
          }
          return _results;
        }).call(_this);
        if (callback) {
          return callback();
        }
      };
    })(this));
  };

  MIDIFileReader.prototype._readTrack = function(trackNumber) {
    var deltaTime, endByte, endOfTrack, event, eventChunkType, eventsAtTime, heldPitches, time, track, trackNumBytes;
    if (this.stream.uInt32BE() !== TRACK_CHUNK_ID) {
      throw "Invalid MIDI file: Missing track chunk ID on track number " + trackNumber;
    }
    track = {};
    this._notes = {};
    this._timeOffset = 0;
    this._trackNumber = trackNumber;
    trackNumBytes = this.stream.uInt32BE();
    endByte = this.stream.byteOffset + trackNumBytes;
    endOfTrack = false;
    while (this.stream.byteOffset < endByte) {
      if (endOfTrack) {
        throw "Invalid MIDI file: Early end of track event occurred on track number " + trackNumber;
      }
      deltaTime = this._readVarLen();
      this._timeOffset += deltaTime;
      eventChunkType = this.stream.uInt8();
      event = (function() {
        switch (eventChunkType) {
          case META_EVENT:
            return this._readMetaEvent();
          case SYSEX_EVENT:
          case SYSEX_CHUNK:
            return this._readSysExEvent(eventChunkType);
          default:
            return this._readChannelEvent(eventChunkType);
        }
      }).call(this);
      if (event) {
        if (event === END_OF_TRACK) {
          endOfTrack = true;
        } else {
          if (event.time != null) {
            time = event.time;
            delete event.time;
          } else {
            time = this._currentTime();
          }
          eventsAtTime = (track[time] != null ? track[time] : track[time] = []);
          eventsAtTime.push(event);
        }
      }
    }
    if (!endOfTrack) {
      throw "Invalid MIDI file: Missing end of track event on track number " + trackNumber;
    }
    heldPitches = Object.keys(this._notes);
    if (heldPitches.length > 0) {
      console.log("Warning: ignoring hung notes on track number " + trackNumber + " for pitches: " + heldPitches);
    }
    return track;
  };

  MIDIFileReader.prototype._readMetaEvent = function() {
    var denominatorPower, firstByte, frame, framerate, hour, key, keyValue, minute, numerator, scale, scaleValue, second, subframe, type, _ref, _ref1, _ref2;
    type = this.stream.uInt8();
    switch (type) {
      case SEQ_NUMBER:
        return {
          type: 'sequence number',
          number: this._readMetaValue()
        };
      case TEXT:
        return {
          type: 'text',
          text: this._readMetaText()
        };
      case COPYRIGHT:
        return {
          type: 'copyright',
          text: this._readMetaText()
        };
      case SEQ_NAME:
        return {
          type: 'sequence name',
          text: this._readMetaText()
        };
      case INSTRUMENT_NAME:
        return {
          type: 'instrument name',
          text: this._readMetaText()
        };
      case LYRICS:
        return {
          type: 'lyrics',
          text: this._readMetaText()
        };
      case MARKER:
        return {
          type: 'marker',
          text: this._readMetaText()
        };
      case CUE_POINT:
        return {
          type: 'cue point',
          text: this._readMetaText()
        };
      case CHANNEL_PREFIX:
        return {
          type: 'channel prefix',
          channel: this._readMetaValue()
        };
      case END_OF_TRACK:
        this._readMetaData();
        return END_OF_TRACK;
      case TEMPO:
        return {
          type: 'tempo',
          bpm: MICROSECONDS_PER_MINUTE / this._readMetaValue()
        };
      case SMPTE_OFFSET:
        _ref = this._readMetaData(), firstByte = _ref[0], minute = _ref[1], second = _ref[2], frame = _ref[3], subframe = _ref[4];
        framerate = (function() {
          switch ((firstByte & 0x60) >> 5) {
            case 0:
              return 24;
            case 1:
              return 25;
            case 2:
              return 29.97;
            case 3:
              return 30;
          }
        })();
        hour = firstByte & 0x1F;
        return {
          type: 'smpte offset',
          framerate: framerate,
          hour: hour,
          minute: minute,
          second: second,
          frame: frame,
          subframe: subframe
        };
      case TIME_SIGNATURE:
        _ref1 = this._readMetaData(), numerator = _ref1[0], denominatorPower = _ref1[1];
        return {
          type: 'time signature',
          numerator: numerator,
          denominator: Math.pow(2, denominatorPower)
        };
      case KEY_SIGNATURE:
        _ref2 = this._readMetaData(), keyValue = _ref2[0], scaleValue = _ref2[1];
        keyValue = (keyValue ^ 128) - 128;
        key = KEY_VALUE_TO_NAME[keyValue] || keyValue;
        scale = (function() {
          switch (scaleValue) {
            case 0:
              return 'major';
            case 1:
              return 'minor';
            default:
              return scaleValue;
          }
        })();
        return {
          type: 'key signature',
          key: key,
          scale: scale
        };
      case SEQ_SPECIFIC:
        return {
          type: 'sequencer specific',
          data: this._readMetaData()
        };
      default:
        return console.log(("Warning: ignoring unknown meta event on track number " + this._trackNumber + " ") + ("type: " + (type.toString(16)) + ", data: " + (this._readMetaData()) + " "));
    }
  };

  MIDIFileReader.prototype._readSysExEvent = function(type) {
    var data, length, _, _i;
    length = this._readVarLen();
    data = [];
    for (_ = _i = 0; _i < length; _ = _i += 1) {
      data.push(this.stream.uInt8());
    }
    return {
      type: "sysex:" + (type.toString(16)),
      data: data
    };
  };

  MIDIFileReader.prototype._readChannelEvent = function(eventChunkType) {
    var channel, event, runningStatus, typeMask;
    typeMask = eventChunkType & 0xF0;
    channel = (eventChunkType & 0x0F) + 1;
    event = (function() {
      switch (typeMask) {
        case NOTE_ON:
          return this._readNoteOn();
        case NOTE_OFF:
          return this._readNoteOff();
        case NOTE_AFTERTOUCH:
          return {
            type: 'note aftertouch',
            pitch: this.stream.uInt8(),
            value: this.stream.uInt8()
          };
        case CONTROLLER:
          return {
            type: 'controller',
            number: this.stream.uInt8(),
            value: this.stream.uInt8()
          };
        case PROGRAM_CHANGE:
          return {
            type: 'program change',
            number: this.stream.uInt8()
          };
        case CHANNEL_AFTERTOUCH:
          return {
            type: 'channel aftertouch',
            value: this.stream.uInt8()
          };
        case PITCH_BEND:
          return {
            type: 'pitch bend',
            value: (this.stream.uInt8() << 7) + this.stream.uInt8()
          };
        default:
          runningStatus = true;
          this.stream.feedByte(eventChunkType);
          return this._readChannelEvent(this.prevEventChunkType);
      }
    }).call(this);
    if (!runningStatus) {
      if (event) {
        event.channel = channel;
      }
      this.prevEventChunkType = eventChunkType;
    }
    return event;
  };

  MIDIFileReader.prototype._readNoteOn = function() {
    var pitch, velocity;
    pitch = this.stream.uInt8();
    velocity = this.stream.uInt8();
    if (velocity === 0) {
      return this._readNoteOff(pitch);
    } else {
      if (this._notes[pitch]) {
        console.log("Warning: ignoring overlapping note on track number " + this._trackNumber + " for pitch " + pitch);
      } else {
        this._notes[pitch] = [velocity, this._currentTime()];
      }
      return null;
    }
  };

  MIDIFileReader.prototype._readNoteOff = function(pitch) {
    var event, release, startTime, velocity, _ref;
    if (!pitch) {
      pitch = this.stream.uInt8();
      release = this.stream.uInt8();
    }
    if (this._notes[pitch]) {
      _ref = this._notes[pitch], velocity = _ref[0], startTime = _ref[1];
      delete this._notes[pitch];
      event = {
        type: 'note',
        pitch: pitch,
        velocity: velocity,
        duration: this._currentTime() - startTime
      };
      if (release) {
        event.release = release;
      }
      event.time = startTime;
      return event;
    } else {
      console.log("Warning: ignoring unmatched note off event on track " + this._trackNumber + " for pitch " + pitch);
      return null;
    }
  };

  MIDIFileReader.prototype._currentTime = function() {
    return this._timeOffset / this.timeDiv;
  };

  MIDIFileReader.prototype._readMetaValue = function() {
    var length, value, _, _i;
    length = this._readVarLen();
    value = 0;
    for (_ = _i = 0; _i < length; _ = _i += 1) {
      value = (value << 8) + this.stream.uInt8();
    }
    return value;
  };

  MIDIFileReader.prototype._readMetaText = function() {
    var data, length, _, _i;
    length = this._readVarLen();
    data = [];
    for (_ = _i = 0; _i < length; _ = _i += 1) {
      data.push(this.stream.uInt8());
    }
    return String.fromCharCode.apply(this, data);
  };

  MIDIFileReader.prototype._readMetaData = function() {
    var data, length, _, _i;
    length = this._readVarLen();
    if (length > 0) {
      data = [];
      for (_ = _i = 0; _i < length; _ = _i += 1) {
        data.push(this.stream.uInt8());
      }
    }
    return data;
  };

  MIDIFileReader.prototype._readVarLen = function() {
    var data, _byte;
    data = 0;
    _byte = this.stream.uInt8();
    while ((_byte & 0x80) !== 0) {
      data = (data << 7) + (_byte & 0x7F);
      _byte = this.stream.uInt8();
    }
    return (data << 7) + (_byte & 0x7F);
  };

  return MIDIFileReader;

})();

NodeFileStream = (function() {
  var FS;

  FS = require('fs');

  function NodeFileStream(filepath) {
    this.filepath = filepath;
  }

  NodeFileStream.prototype.open = function(onSuccess, onError) {
    console.log("Reading " + this.filepath);
    FS.readFile(this.filepath, (function(_this) {
      return function(error, buffer) {
        if (error) {
          if (onError) {
            onError(error);
          } else {
            throw error;
          }
        }
        _this._buffer = buffer;
        _this.byteOffset = 0;
        if (onSuccess) {
          return onSuccess();
        }
      };
    })(this));
  };

  NodeFileStream.prototype.uInt32BE = function() {
    var data;
    data = this._buffer.readUInt32BE(this.byteOffset);
    this.byteOffset += 4;
    return data;
  };

  NodeFileStream.prototype.uInt16BE = function() {
    var data;
    data = this._buffer.readUInt16BE(this.byteOffset);
    this.byteOffset += 2;
    return data;
  };

  NodeFileStream.prototype.uInt8 = function() {
    var data;
    if (this.nextByte) {
      data = this.nextByte;
      this.nextByte = null;
    } else {
      data = this._buffer.readUInt8(this.byteOffset);
      this.byteOffset += 1;
    }
    return data;
  };

  NodeFileStream.prototype.feedByte = function(byte) {
    this.nextByte = byte;
  };

  return NodeFileStream;

})();

filepath = process.argv[2];

if (!filepath) {
  throw 'MIDI input file path is required';
}

midi = new MIDIFileReader(new NodeFileStream(filepath));

midi.read(function() {
  console.log("Tracks:");
  console.log(JSON.stringify(midi.tracks, null, 2));
  console.log("MIDI format type: " + midi.formatType);
  console.log("Number of tracks: " + midi.numTracks);
  return console.log("Time division: " + midi.timeDiv);
});