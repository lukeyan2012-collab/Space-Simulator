/**
 * @typedef {Object} BodyState
 * @property {string} id
 * @property {number} mass            kg
 * @property {[number,number,number]} position  meters
 * @property {[number,number,number]} velocity  m/s
 *
 * @typedef {Object} PhysicsEngine
 * @property {(spec: Omit<BodyState,'id'> & {id?:string}) => string} addBody
 * @property {(id: string) => void} removeBody
 * @property {(id: string) => BodyState | undefined} getState
 * @property {(id: string, partial: Partial<BodyState>) => void} setState
 * @property {(dt_seconds: number) => void} step
 * @property {() => BodyState[]} all
 * @property {() => void} clear
 */

export const ENGINE_INTERFACE_KEYS = [
  'addBody', 'removeBody', 'getState', 'setState', 'step', 'all', 'clear',
];
