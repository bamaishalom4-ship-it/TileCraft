import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_REWARD_SCHEDULE,
  evaluateDailyStreak,
  formatTxLabel,
  getUtcDateKey,
} from '../economyUtils';

describe('Daily Login Streak & Economy Utilities', () => {
  it('starts new players at Day 1 with 40 coins claimable', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    const status = evaluateDailyStreak(null, 0, now);

    assert.equal(status.canClaimToday, true);
    assert.equal(status.currentStreak, 0);
    assert.equal(status.nextClaimDay, 1);
    assert.equal(status.nextRewardCoins, DAILY_REWARD_SCHEDULE[0]);
  });

  it('prevents double-claiming on the same UTC calendar day', () => {
    const now = new Date('2026-11-24T22:00:00Z');
    const today = getUtcDateKey(now);
    const status = evaluateDailyStreak(today, 3, now);

    assert.equal(status.canClaimToday, false);
    assert.equal(status.currentStreak, 3);
    assert.equal(status.nextClaimDay, 4);
    assert.equal(status.nextRewardCoins, DAILY_REWARD_SCHEDULE[3]);
  });

  it('advances streak when last claim was yesterday and wraps Day 7 back to Day 1', () => {
    const now = new Date('2026-11-24T08:00:00Z');

    const day4 = evaluateDailyStreak('2026-11-23', 3, now);
    assert.equal(day4.canClaimToday, true);
    assert.equal(day4.nextClaimDay, 4);
    assert.equal(day4.nextRewardCoins, 80);

    const day7 = evaluateDailyStreak('2026-11-23', 6, now);
    assert.equal(day7.nextClaimDay, 7);
    assert.equal(day7.nextRewardCoins, 200);

    const wrapToDay1 = evaluateDailyStreak('2026-11-23', 7, now);
    assert.equal(wrapToDay1.nextClaimDay, 1);
    assert.equal(wrapToDay1.nextRewardCoins, 40);
  });

  it('resets streak back to Day 1 if the player missed a full day', () => {
    const now = new Date('2026-11-24T08:00:00Z');
    const missed = evaluateDailyStreak('2026-11-22', 5, now);

    assert.equal(missed.canClaimToday, true);
    assert.equal(missed.currentStreak, 0);
    assert.equal(missed.nextClaimDay, 1);
    assert.equal(missed.nextRewardCoins, 40);
  });

  it('formats all coin transaction labels cleanly', () => {
    assert.equal(formatTxLabel('daily_reward'), 'Daily Login Streak');
    assert.equal(formatTxLabel('rewarded_ad'), 'Rewarded Video Ad');
    assert.equal(formatTxLabel('iap_pack'), 'Coin Pack Purchase');
    assert.equal(formatTxLabel('creator_royalty'), 'Creator Royalty Earned');
  });
});
