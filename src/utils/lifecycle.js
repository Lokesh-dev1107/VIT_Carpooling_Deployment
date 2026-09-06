const crypto = require('crypto');

// ---------- CONSTANTS ----------
const FORMING_WINDOW_MS = 10 * 60 * 1000;      // 10 minutes to fill seats
const LEAVE_CUTOFF_MS = 2 * 60 * 60 * 1000;    // members must leave >2hrs before departure
const HOST_CANCEL_CUTOFF_MS = 10 * 60 * 1000;  // host can cancel up until 10 min before departure

function generateGroupCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

function findMemberByToken(group, memberToken) {
  return group.members.find(m => m.memberToken === memberToken);
}

function applyLifecycleRules(group) {
  const now = Date.now();

  if (group.status === 'FORMING' && now > group.formingDeadline.getTime()) {
    group.status = 'EXPIRED';
    return group;
  }

  if (group.status !== 'CANCELLED' && group.status !== 'EXPIRED') {
    if (now > group.departureTime.getTime() - HOST_CANCEL_CUTOFF_MS && group.status !== 'CONFIRMED') {
      group.status = 'EXPIRED';
    }
  }

  return group;
}

async function saveWithLifecycle(group) {
  applyLifecycleRules(group);
  await group.save();
  return group;
}

function isFull(group) {
  return group.members.length >= group.totalSeats;
}

function toPublicGroup(group) {
  const obj = group.toObject();
  obj.members = obj.members.map(({ memberToken, ...rest }) => rest);
  return obj;
}

module.exports = {
  FORMING_WINDOW_MS,
  LEAVE_CUTOFF_MS,
  HOST_CANCEL_CUTOFF_MS,
  generateGroupCode,
  findMemberByToken,
  applyLifecycleRules,
  saveWithLifecycle,
  isFull,
  toPublicGroup
};