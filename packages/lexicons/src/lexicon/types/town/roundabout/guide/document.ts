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
const id = 'town.roundabout.guide.document'

export interface Main {
  $type: 'town.roundabout.guide.document'
  title: string
  /** Display-only flag; behavior-neutral. */
  type?: 'curated' | 'list' | (string & {})
  text: string
  facets?: Facet[]
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

/** A typed annotation over a byte range of the document text. */
export interface Facet {
  $type?: 'town.roundabout.guide.document#facet'
  index: ByteSlice
  features: (
    | $Typed<Format>
    | $Typed<Link>
    | $Typed<PlaceRef>
    | $Typed<EventRef>
    | { $type: string }
  )[]
}

const hashFacet = 'facet'

export function isFacet<V>(v: V) {
  return is$typed(v, id, hashFacet)
}

export function validateFacet<V>(v: V) {
  return validate<Facet & V>(v, id, hashFacet)
}

/** A byte index range into the UTF-8 encoded text. End-exclusive. */
export interface ByteSlice {
  $type?: 'town.roundabout.guide.document#byteSlice'
  byteStart: number
  byteEnd: number
}

const hashByteSlice = 'byteSlice'

export function isByteSlice<V>(v: V) {
  return is$typed(v, id, hashByteSlice)
}

export function validateByteSlice<V>(v: V) {
  return validate<ByteSlice & V>(v, id, hashByteSlice)
}

/** Inline text formatting. */
export interface Format {
  $type?: 'town.roundabout.guide.document#format'
  kind: 'bold' | 'italic' | (string & {})
}

const hashFormat = 'format'

export function isFormat<V>(v: V) {
  return is$typed(v, id, hashFormat)
}

export function validateFormat<V>(v: V) {
  return validate<Format & V>(v, id, hashFormat)
}

/** A hyperlink. */
export interface Link {
  $type?: 'town.roundabout.guide.document#link'
  uri: string
}

const hashLink = 'link'

export function isLink<V>(v: V) {
  return is$typed(v, id, hashLink)
}

export function validateLink<V>(v: V) {
  return validate<Link & V>(v, id, hashLink)
}

/** A reference to a town.roundabout.guide.place record, with a rendering intent. */
export interface PlaceRef {
  $type?: 'town.roundabout.guide.document#placeRef'
  ref: ComAtprotoRepoStrongRef.Main
  intent: 'hero' | 'card' | 'chip' | (string & {})
}

const hashPlaceRef = 'placeRef'

export function isPlaceRef<V>(v: V) {
  return is$typed(v, id, hashPlaceRef)
}

export function validatePlaceRef<V>(v: V) {
  return validate<PlaceRef & V>(v, id, hashPlaceRef)
}

/** A reference to a community.lexicon.calendar.event record, with a rendering intent. */
export interface EventRef {
  $type?: 'town.roundabout.guide.document#eventRef'
  ref: ComAtprotoRepoStrongRef.Main
  intent: 'card' | (string & {})
}

const hashEventRef = 'eventRef'

export function isEventRef<V>(v: V) {
  return is$typed(v, id, hashEventRef)
}

export function validateEventRef<V>(v: V) {
  return validate<EventRef & V>(v, id, hashEventRef)
}
