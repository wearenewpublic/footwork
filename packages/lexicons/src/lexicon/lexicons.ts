/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  ComAtprotoRepoStrongRef: {
    lexicon: 1,
    id: 'com.atproto.repo.strongRef',
    description: 'A URI with a content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  CommunityLexiconCalendarEvent: {
    lexicon: 1,
    id: 'community.lexicon.calendar.event',
    defs: {
      main: {
        type: 'record',
        description: 'A calendar event.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['createdAt', 'name'],
          properties: {
            name: {
              type: 'string',
              description: 'The name of the event.',
            },
            description: {
              type: 'string',
              description: 'The description of the event.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when the event was created.',
            },
            startsAt: {
              type: 'string',
              format: 'datetime',
              description: 'Client-declared timestamp when the event starts.',
            },
            endsAt: {
              type: 'string',
              format: 'datetime',
              description: 'Client-declared timestamp when the event ends.',
            },
            mode: {
              type: 'ref',
              ref: 'lex:community.lexicon.calendar.event#mode',
              description: 'The attendance mode of the event.',
            },
            status: {
              type: 'ref',
              ref: 'lex:community.lexicon.calendar.event#status',
              description: 'The status of the event.',
            },
            locations: {
              type: 'array',
              description: 'The locations where the event takes place.',
              items: {
                type: 'union',
                refs: [
                  'lex:community.lexicon.calendar.event#uri',
                  'lex:community.lexicon.location.address',
                  'lex:community.lexicon.location.fsq',
                  'lex:community.lexicon.location.geo',
                  'lex:community.lexicon.location.hthree',
                ],
              },
            },
            uris: {
              type: 'array',
              description: 'URIs associated with the event.',
              items: {
                type: 'ref',
                ref: 'lex:community.lexicon.calendar.event#uri',
              },
            },
            rsvpExpected: {
              type: 'boolean',
              description: 'Whether a response is requested from attendees.',
            },
          },
        },
      },
      mode: {
        type: 'string',
        description: 'The mode of the event.',
        default: 'community.lexicon.calendar.event#inperson',
        knownValues: [
          'community.lexicon.calendar.event#hybrid',
          'community.lexicon.calendar.event#inperson',
          'community.lexicon.calendar.event#virtual',
        ],
      },
      virtual: {
        type: 'token',
        description: 'A virtual event that takes place online.',
      },
      inperson: {
        type: 'token',
        description: 'An in-person event that takes place offline.',
      },
      hybrid: {
        type: 'token',
        description: 'A hybrid event that takes place both online and offline.',
      },
      status: {
        type: 'string',
        description: 'The status of the event.',
        default: 'community.lexicon.calendar.event#scheduled',
        knownValues: [
          'community.lexicon.calendar.event#cancelled',
          'community.lexicon.calendar.event#planned',
          'community.lexicon.calendar.event#postponed',
          'community.lexicon.calendar.event#rescheduled',
          'community.lexicon.calendar.event#scheduled',
        ],
      },
      planned: {
        type: 'token',
        description: 'The event has been created, but not finalized.',
      },
      scheduled: {
        type: 'token',
        description: 'The event has been created and scheduled.',
      },
      rescheduled: {
        type: 'token',
        description: 'The event has been rescheduled.',
      },
      cancelled: {
        type: 'token',
        description: 'The event has been cancelled.',
      },
      postponed: {
        type: 'token',
        description:
          'The event has been postponed and a new start date has not been set.',
      },
      uri: {
        type: 'object',
        description: 'A URI associated with the event.',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          name: {
            type: 'string',
            description: 'The display name of the URI.',
          },
        },
      },
    },
  },
  CommunityLexiconLocationAddress: {
    lexicon: 1,
    id: 'community.lexicon.location.address',
    defs: {
      main: {
        type: 'object',
        description: 'A physical location in the form of a street address.',
        required: ['country'],
        properties: {
          country: {
            type: 'string',
            description:
              'The ISO 3166 country code. Preferably the 2-letter code.',
            minLength: 2,
            maxLength: 10,
          },
          postalCode: {
            type: 'string',
            description: 'The postal code of the location.',
          },
          region: {
            type: 'string',
            description:
              'The administrative region of the country. For example, a state in the USA.',
          },
          locality: {
            type: 'string',
            description:
              'The locality of the region. For example, a city in the USA.',
          },
          street: {
            type: 'string',
            description: 'The street address.',
          },
          name: {
            type: 'string',
            description: 'The name of the location.',
          },
        },
      },
    },
  },
  CommunityLexiconLocationFsq: {
    lexicon: 1,
    id: 'community.lexicon.location.fsq',
    defs: {
      main: {
        type: 'object',
        description:
          'A physical location contained in the Foursquare Open Source Places dataset.',
        required: ['fsq_place_id'],
        properties: {
          fsq_place_id: {
            type: 'string',
            description: 'The unique identifier of a Foursquare POI.',
          },
          latitude: {
            type: 'string',
          },
          longitude: {
            type: 'string',
          },
          name: {
            type: 'string',
            description: 'The name of the location.',
          },
        },
      },
    },
  },
  CommunityLexiconLocationGeo: {
    lexicon: 1,
    id: 'community.lexicon.location.geo',
    defs: {
      main: {
        type: 'object',
        description: 'A physical location in the form of a WGS84 coordinate.',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'string',
          },
          longitude: {
            type: 'string',
          },
          altitude: {
            type: 'string',
          },
          name: {
            type: 'string',
            description: 'The name of the location.',
          },
        },
      },
    },
  },
  CommunityLexiconLocationHthree: {
    lexicon: 1,
    id: 'community.lexicon.location.hthree',
    defs: {
      main: {
        type: 'object',
        description:
          'A physical location in the form of a H3 encoded location.',
        required: ['value'],
        properties: {
          value: {
            type: 'string',
            description: 'The h3 encoded location.',
          },
          name: {
            type: 'string',
            description: 'The name of the location.',
          },
        },
      },
    },
  },
  TownRoundaboutGuideDocument: {
    lexicon: 1,
    id: 'town.roundabout.guide.document',
    defs: {
      main: {
        type: 'record',
        description:
          'A guide: narrative prose with byte-ranged facets referencing places and events.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['title', 'text', 'createdAt'],
          properties: {
            title: {
              type: 'string',
              maxLength: 1200,
              maxGraphemes: 300,
            },
            type: {
              type: 'string',
              knownValues: ['curated', 'list'],
              description: 'Display-only flag; behavior-neutral.',
            },
            text: {
              type: 'string',
              maxLength: 100000,
              maxGraphemes: 30000,
            },
            facets: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:town.roundabout.guide.document#facet',
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      facet: {
        type: 'object',
        description:
          'A typed annotation over a byte range of the document text.',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:town.roundabout.guide.document#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:town.roundabout.guide.document#format',
                'lex:town.roundabout.guide.document#link',
                'lex:town.roundabout.guide.document#placeRef',
                'lex:town.roundabout.guide.document#eventRef',
              ],
            },
          },
        },
      },
      byteSlice: {
        type: 'object',
        description:
          'A byte index range into the UTF-8 encoded text. End-exclusive.',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      format: {
        type: 'object',
        description: 'Inline text formatting.',
        required: ['kind'],
        properties: {
          kind: {
            type: 'string',
            knownValues: ['bold', 'italic'],
          },
        },
      },
      link: {
        type: 'object',
        description: 'A hyperlink.',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      placeRef: {
        type: 'object',
        description:
          'A reference to a town.roundabout.guide.place record, with a rendering intent.',
        required: ['ref'],
        properties: {
          ref: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
          intent: {
            type: 'string',
            knownValues: ['hero', 'card', 'chip'],
            default: 'card',
          },
        },
      },
      eventRef: {
        type: 'object',
        description:
          'A reference to a community.lexicon.calendar.event record, with a rendering intent.',
        required: ['ref'],
        properties: {
          ref: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
          intent: {
            type: 'string',
            knownValues: ['card'],
            default: 'card',
          },
        },
      },
    },
  },
  TownRoundaboutGuidePlace: {
    lexicon: 1,
    id: 'town.roundabout.guide.place',
    defs: {
      main: {
        type: 'record',
        description:
          'A standalone place: a display name plus a community.lexicon location payload.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 1200,
              maxGraphemes: 300,
            },
            location: {
              type: 'union',
              refs: [
                'lex:community.lexicon.location.address',
                'lex:community.lexicon.location.geo',
                'lex:community.lexicon.location.fsq',
              ],
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  TownRoundaboutGuideSave: {
    lexicon: 1,
    id: 'town.roundabout.guide.save',
    defs: {
      main: {
        type: 'record',
        description: 'A user saving a guide document into their own repo.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  TownRoundaboutGuideVenueReview: {
    lexicon: 1,
    id: 'town.roundabout.guide.venueReview',
    defs: {
      main: {
        type: 'record',
        description:
          'A rich review wrapper: intrinsic copy and rating, referencing a place. Extension point; not wired into the spike round-trip.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['place', 'text', 'createdAt'],
          properties: {
            place: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            text: {
              type: 'string',
              maxLength: 10000,
              maxGraphemes: 3000,
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
  CommunityLexiconCalendarEvent: 'community.lexicon.calendar.event',
  CommunityLexiconLocationAddress: 'community.lexicon.location.address',
  CommunityLexiconLocationFsq: 'community.lexicon.location.fsq',
  CommunityLexiconLocationGeo: 'community.lexicon.location.geo',
  CommunityLexiconLocationHthree: 'community.lexicon.location.hthree',
  TownRoundaboutGuideDocument: 'town.roundabout.guide.document',
  TownRoundaboutGuidePlace: 'town.roundabout.guide.place',
  TownRoundaboutGuideSave: 'town.roundabout.guide.save',
  TownRoundaboutGuideVenueReview: 'town.roundabout.guide.venueReview',
} as const
