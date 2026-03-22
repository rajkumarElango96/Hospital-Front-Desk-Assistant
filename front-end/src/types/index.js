// JSDoc type hints — gives editor autocomplete without TypeScript.
// Safe to delete once API integration is complete.

/**
 * @typedef {Object} Patient
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} name
 * @property {string} initials
 * @property {string} dob
 * @property {string} email
 * @property {string} phone
 * @property {boolean} smsOptIn
 */

/**
 * @typedef {Object} Slot
 * @property {string} id
 * @property {string} date
 * @property {string} time
 */

/**
 * @typedef {Object} Doctor
 * @property {string} id
 * @property {string} name
 * @property {string} specialty
 * @property {string} color
 * @property {string} bio
 * @property {string[]} keywords
 * @property {Slot[]} slots
 */

/**
 * @typedef {'active'|'expired'} PrescriptionStatus
 * @typedef {Object} Prescription
 * @property {string} name
 * @property {string} dosage
 * @property {number} refills
 * @property {string} expires
 * @property {PrescriptionStatus} status
 */

/**
 * @typedef {'text'|'slots'|'confirmation'|'office'|'prescription'} MessageType
 * @typedef {Object} Message
 * @property {string} id
 * @property {'ai'|'user'} role
 * @property {MessageType} type
 * @property {string} [text]
 * @property {string} time
 * @property {Doctor} [doctor]
 */
