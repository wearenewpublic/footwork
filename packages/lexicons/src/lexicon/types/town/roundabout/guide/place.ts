/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons.js'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util.js'
import type * as CommunityLexiconLocationAddress from '../../../community/lexicon/location/address.js'
import type * as CommunityLexiconLocationGeo from '../../../community/lexicon/location/geo.js'
import type * as CommunityLexiconLocationFsq from '../../../community/lexicon/location/fsq.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'town.roundabout.guide.place'

export interface Main {
  $type: 'town.roundabout.guide.place'
  name: string
  location?: (
    | $Typed<CommunityLexiconLocationAddress.Main>
    | $Typed<CommunityLexiconLocationGeo.Main>
    | $Typed<CommunityLexiconLocationFsq.Main>
    | { $type: string }
  )[]
  createdAt: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}
