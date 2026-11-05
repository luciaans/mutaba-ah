import test from "node:test";
import assert from "node:assert/strict";
import { attendanceCheckedMap, isMissedFromCheckbox } from "../lib/attendance";
import { executionPercentage } from "../lib/metrics";
import { prayerForTime, todayInAppTimeZone, weekRangeInAppTimeZone, monthRangeInAppTimeZone } from "../lib/time";

test("checkbox dicentang berarti tidak melaksanakan", () => {
  assert.equal(isMissedFromCheckbox(true), true);
  assert.equal(isMissedFromCheckbox(false), false);
});

test("draft tanpa sesi tersimpan tidak dianggap catatan", () => {
  const draft = attendanceCheckedMap([{ id: "a" }, { id: "b" }], [{ student_id: "a", is_missed: true }], false);
  assert.deepEqual(draft, { a: false, b: false });
});

test("sesi tersimpan memuat status dan santri baru tetap belum tercatat", () => {
  const saved = attendanceCheckedMap([{ id: "a" }, { id: "b" }], [{ student_id: "a", is_missed: true }], true);
  assert.deepEqual(saved, { a: true, b: false });
});

test("persentase menggunakan data tersimpan dan aman untuk pembagian nol", () => {
  assert.equal(executionPercentage(3, 4), 75);
  assert.equal(executionPercentage(1, 3), 33.3);
  assert.equal(executionPercentage(0, 0), null);
  assert.equal(executionPercentage(0, 5), 0);
});

test("tanggal hari ini mengikuti Asia/Pontianak, bukan UTC", () => {
  assert.equal(todayInAppTimeZone(new Date("2026-11-03T17:30:00.000Z")), "2026-11-04");
  assert.equal(prayerForTime(new Date("2026-11-04T02:00:00.000Z")), "subuh");
});

test("rentang minggu Senin–Minggu dan Sabtu–Jumat akurat", () => {
  assert.deepEqual(weekRangeInAppTimeZone("2026-11-04", "monday"), { start: "2026-11-02", end: "2026-11-08" });
  assert.deepEqual(weekRangeInAppTimeZone("2026-11-04", "saturday"), { start: "2026-10-31", end: "2026-11-06" });
});

test("rentang bulanan menghormati jumlah hari dalam kalender", () => {
  assert.deepEqual(monthRangeInAppTimeZone("2026-02-01"), { start: "2026-02-01", end: "2026-02-28" });
});
