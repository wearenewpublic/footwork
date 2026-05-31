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
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'town.roundabout.guide.facet'

/** An inline reference to a town.roundabout.guide.place record. */
export interface Place {
  $type?: 'town.roundabout.guide.facet#place'
  ref: ComAtprotoRepoStrongRef.Main
  intent: 'hero' | 'card' | 'chip' | (string & {})
}

const hashPlace = 'place'

export function isPlace<V>(v: V) {
  return is$typed(v, id, hashPlace)
}

export function validatePlace<V>(v: V) {
  return validate<Place & V>(v, id, hashPlace)
}

/** An inline reference to a community.lexicon.calendar.event record. */
export interface Event {
  $type?: 'town.roundabout.guide.facet#event'
  ref: ComAtprotoRepoStrongRef.Main
  intent: 'card' | (string & {})
}

const hashEvent = 'event'

export function isEvent<V>(v: V) {
  return is$typed(v, id, hashEvent)
}

export function validateEvent<V>(v: V) {
  return validate<Event & V>(v, id, hashEvent)
}
