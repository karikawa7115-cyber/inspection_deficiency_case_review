-- Anonymized seed data for Inspection Deficiency Database (read-only prototype)
-- Run after schema.sql. All names/ports are fictional.

-- ---------------------------------------------------------------------------
-- vessels (3 active demo vessels)
-- vessel_name = display name shown in UI; actual_name left null in prototype
-- ---------------------------------------------------------------------------
insert into public.vessels (id, vessel_code, vessel_name, actual_name, vessel_type, is_active)
values
  ('11111111-1111-4111-8111-111111111101', 'DVA', 'DEMO VESSEL ALPHA', null, 'Bulk Carrier', true),
  ('11111111-1111-4111-8111-111111111102', 'DVB', 'DEMO VESSEL BRAVO', null, 'General Cargo Ship', true),
  ('11111111-1111-4111-8111-111111111103', 'DVC', 'DEMO VESSEL CHARLIE', null, 'Container Ship', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- inspection_cases (6 cases across 3 vessels)
-- ---------------------------------------------------------------------------
insert into public.inspection_cases (
  id, vessel_id, case_id, inspection_type, inspection_date, port, country, status
)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101',
   'DVA_PSC_2025-11-10_PORT-A', 'PSC', '2025-11-10', 'PORT ALPHA', 'Country A', 'closed'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101',
   'DVA_PSC_2026-01-20_PORT-B', 'PSC', '2026-01-20', 'PORT BETA', 'Country B', 'reviewing'),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102',
   'DVB_PSC_2026-02-05_PORT-C', 'PSC', '2026-02-05', 'PORT GAMMA', 'Country C', 'reviewing'),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111102',
   'DVB_FLAG_2026-02-28_PORT-D', 'Flag State', '2026-02-28', 'PORT DELTA', 'Country D', 'open'),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111103',
   'DVC_PSC_2026-03-08_PORT-E', 'PSC', '2026-03-08', 'PORT EPSILON', 'Country E', 'reviewing'),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111103',
   'DVC_INTERNAL_2026-03-15_PORT-F', 'Internal Audit', '2026-03-15', 'PORT FOXTROT', 'Country F', 'closed')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- deficiencies (16 rows - includes all required alert patterns)
-- ---------------------------------------------------------------------------
insert into public.deficiencies (
  id, inspection_case_id, deficiency_no, title, category,
  risk_level, original_finding, vessel_cause, corrective_action, preventive_action,
  is_repeated, root_cause_status, preventive_action_status,
  handover_required, internal_audit_status
)
values
  -- DVA / PORT-A (baseline + root cause too general + preventive weak)
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', 1,
   'Self-closing fire door not fully closed',
   '07105', 'low',
   'Self-closing fire door between wheelhouse and stairway did not close completely during PSC inspection.',
   'Door closer pressure was not adjusted during the last quarterly fire door check.',
   'Adjusted door closer; door now closes fully.',
   'Include fire door closure check in quarterly inspection checklist with responsible rank.',
   false, 'ok', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201', 2,
   'Garbage record book entry error',
   '01320', 'medium',
   'Garbage record book contained entries made with correction fluid.',
   'Human error.',
   'Stopped use of correction fluid; entries rewritten where required.',
   'Crew reminded to follow garbage record book procedures.',
   false, 'too_general', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222201', 3,
   'Engine room ventilator could not close immediately',
   '07116', 'medium',
   'Ventilator for engine room (starboard side) could not be closed immediately.',
   'Insufficient lubrication of ventilator moving parts.',
   'Eased and greased ventilator; closes immediately now.',
   'Check ventilators during quarterly inspection as necessary.',
   false, 'shallow', 'weak', false, 'none'),

  -- DVA / PORT-B (repeated + handover required)
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222202', 1,
   'Deck line marking not clear',
   '02199', 'medium',
   'Load line deck markings were not clearly visible on upper deck.',
   'Previous deficiency on 2025-09-01 was closed by painting only; follow-up verification was incomplete.',
   'Deck line repainted and verified.',
   'Add deck line visibility check to monthly deck maintenance round.',
   true, 'shallow', 'weak', false, 'candidate'),

  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222202', 2,
   'Lifebuoy not in assigned position',
   '11117', 'high',
   'Pilot station lifebuoy was not in position; starboard quarter lifebuoy grab line damaged.',
   'Lifebuoy repositioned after pilot transfer; grab line wear not detected in routine rounds.',
   'Lifebuoy fitted in position; grab line repaired.',
   'Master to verify lifebuoy positions at each port entry briefing.',
   false, 'ok', 'ok', true, 'none'),

  -- DVB / PORT-C
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222203', 1,
   'Oil record book part I incomplete',
   '13199', 'low',
   'Oil record book Part I missing signature on one operational entry.',
   'Omitted signature during busy departure preparation.',
   'Missing signature added after review.',
   'Chief engineer to verify ORB completeness before port arrival.',
   false, 'ok', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333307', '22222222-2222-4222-8222-222222222203', 2,
   'Pilot ladder steps damaged',
   '10101', 'high',
   'Two pilot ladder rubber steps were blended / damaged.',
   'Pilot boat contact in heavy weather during transfer.',
   'Damaged ladders removed from service; replacement ordered.',
   'Inspect pilot ladders before each use and stow protected when not in use.',
   false, 'too_general', 'weak', false, 'none'),

  ('33333333-3333-4333-8333-333333333308', '22222222-2222-4222-8222-222222222203', 3,
   'Emergency lighting battery low',
   '04108', 'medium',
   'Emergency lighting unit in accommodation corridor showed low battery indication.',
   'Battery end of service life; not replaced during planned maintenance.',
   'Battery replaced; unit tested satisfactory.',
   'Include emergency lighting battery test in monthly safety equipment round.',
   false, 'shallow', 'ok', true, 'candidate'),

  -- DVB / PORT-D
  ('33333333-3333-4333-8333-333333333309', '22222222-2222-4222-8222-222222222204', 1,
   'Muster list not updated',
   '03105', 'low',
   'Muster list did not reflect latest crew change.',
   'Administrative delay after crew sign-off.',
   'Muster list updated and posted.',
   'Update muster list within 24 hours of crew change per SMS.',
   false, 'ok', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333310', '22222222-2222-4222-8222-222222222204', 2,
   'Fire pump pressure below standard',
   '07101', 'high',
   'Fire pump discharge pressure below required value during operational test.',
   'Same machinery space deficiency noted on sister vessel six months earlier; fleet bulletin not applied.',
   'Pump impeller cleared; pressure restored.',
   'Add fire pump pressure test to weekly engine room checklist.',
   true, 'too_general', 'weak', false, 'candidate'),

  -- DVC / PORT-E
  ('33333333-3333-4333-8333-333333333311', '22222222-2222-4222-8222-222222222205', 1,
   'Mooring line tail worn',
   '02115', 'medium',
   'One mooring line tail showed excessive wear at the eye splice.',
   'Normal wear; replacement interval not defined in ship-specific maintenance plan.',
   'Worn tail replaced with spare.',
   'Define mooring line inspection criteria in PMS.',
   false, 'ok', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333312', '22222222-2222-4222-8222-222222222205', 2,
   'Chart correction not applied',
   '10127', 'medium',
   'Latest NAVAREA warning not recorded on chart correction log.',
   'Human error.',
   'Corrections applied and logged.',
   'Second officer to verify chart corrections weekly.',
   false, 'too_general', 'ok', false, 'none'),

  ('33333333-3333-4333-8333-333333333313', '22222222-2222-4222-8222-222222222205', 3,
   'SMS procedure revision overdue',
   '14101', 'low',
   'Shipboard SMS procedure for enclosed space entry review was overdue.',
   'Annual review date missed during crew turnover.',
   'Procedure reviewed and re-approved by master.',
   'Set calendar reminder for annual SMS procedure review.',
   false, 'ok', 'weak', false, 'none'),

  -- DVC / PORT-F (internal audit focus)
  ('33333333-3333-4333-8333-333333333314', '22222222-2222-4222-8222-222222222206', 1,
   'Ballast water record gap',
   '01325', 'medium',
   'Ballast water record book had a one-day gap during port operations.',
   'Recording delegated without verification during concurrent operations.',
   'Gap explained and entries completed.',
   'Chief officer to verify BWRB daily.',
   false, 'shallow', 'ok', false, 'candidate'),

  ('33333333-3333-4333-8333-333333333315', '22222222-2222-4222-8222-222222222206', 2,
   'Hatch cover securing incomplete',
   '01113', 'high',
   'Two hatch cover cleats were not fully secured prior to departure.',
   'Incomplete securing after cargo operations in port.',
   'Cleats secured and checked.',
   'Include hatch securing verification in departure checklist.',
   false, 'ok', 'ok', true, 'none'),

  ('33333333-3333-4333-8333-333333333316', '22222222-2222-4222-8222-222222222206', 3,
   'Auxiliary engine lube oil analysis overdue',
   '09125', 'medium',
   'Scheduled lube oil sample for auxiliary engine was overdue by two months.',
   'Repeated scheduling oversight - same finding on prior internal audit.',
   'Sample taken and sent to shore lab.',
   'Automate PMS reminder for oil sample intervals.',
   true, 'too_general', 'weak', false, 'added')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- review_outputs (sample follow-up text - anonymized)
-- ---------------------------------------------------------------------------
insert into public.review_outputs (
  deficiency_id,
  company_review_comment,
  vessel_revision_request,
  handover_note,
  training_point,
  owner_summary,
  internal_audit_checklist_item,
  how_to_check,
  required_evidence
)
values
  ('33333333-3333-4333-8333-333333333301',
   '[Internal] DEMO VESSEL ALPHA - PSC PORT ALPHA 2025-11-10 - No.01 routine closure.',
   null, null, null,
   '【船主向け要約】デモ船アルファ - 防火戸の調整完了。特記事項なし。',
   null, null, null),

  ('33333333-3333-4333-8333-333333333302',
   '[Internal] Root cause cites human error only. Request vessel to specify training gap and verification step.',
   'To: Master - please revise CR-5 to explain why correction fluid was available and who verifies ORB entries before port.',
   null,
   'Toolbox: garbage record book entry rules and prohibition of correction fluid.',
   '【船主向け要約】記録簿の修正方法に関する指摘。原因の具体化を本船へ依頼中。',
   null,
   'Interview chief cook and chief officer on ORB procedures.',
   'Signed ORB pages for last three months.'),

  ('33333333-3333-4333-8333-333333333304',
   '[Internal] Repeated deck line finding - escalate to fleet bulletin review.',
   null,
   'Handover: verify deck line painting and monthly round records at next superintendent visit.',
   'Training: load line marking visibility requirements.',
   '【船主向け要約】甲板ライン表示の再発指摘。フォローアップ継続。',
   'Verify deck line visibility check is documented in monthly deck maintenance round.',
   'Sample last 3 months deck maintenance checklists; confirm responsible rank signed.',
   'Photos of repainted deck line; signed monthly round sheet.'),

  ('33333333-3333-4333-8333-333333333305',
   '[Internal] High risk - lifebuoy position and grab line. Handover required for next port call.',
   'To: Master - confirm lifebuoy round frequency and record format.',
   'Handover: pilot station lifebuoy must be verified at each port entry. Starboard quarter grab line replaced - confirm spare inventory.',
   null,
   '【船主向け要約】救命浮環の配置・補強ロープ。引き継ぎ注意。',
   null, null, null),

  ('33333333-3333-4333-8333-333333333307',
   '[Internal] Pilot ladder damage - root cause too general; preventive action weak.',
   'To: Master - revise root cause to include pre-use inspection and bad-weather transfer controls.',
   null,
   'Drill: pilot ladder inspection before use.',
   '【船主向け要約】パイロットラダー損傷。原因・再発防止の具体化を依頼。',
   null,
   'Review pilot transfer risk assessment and ladder stowage records.',
   'Pilot ladder inspection log; replacement order confirmation.'),

  ('33333333-3333-4333-8333-333333333308',
   '[Internal] Emergency lighting - handover to attending superintendent at PORT GAMMA.',
   null,
   'Handover: corridor unit replaced - verify all accommodation emergency lights at next crew change.',
   null,
   '【船主向け要約】非常灯バッテリー交換済。引き継ぎ事項あり。',
   'Add emergency lighting battery test to internal audit sample list.',
   'Monthly safety equipment round - confirm emergency lighting column completed.',
   'Battery replacement receipt; monthly round checklist.'),

  ('33333333-3333-4333-8333-333333333310',
   '[Internal] Repeated machinery deficiency - fleet bulletin compliance review needed.',
   'To: Chief Engineer - explain why fleet fire pump bulletin was not applied onboard.',
   null,
   'Training: fire pump weekly test procedure.',
   '【船主向け要約】消火ポンプ再発。艦隊通達の適用状況を確認中。',
   'Sample fire pump weekly test records across fleet.',
   'Compare weekly checklist against fleet bulletin requirements.',
   'Fire pump test log; fleet bulletin acknowledgment sheet.'),

  ('33333333-3333-4333-8333-333333333314',
   '[Internal] Ballast record gap - internal audit checklist candidate.',
   null, null, null,
   '【船主向け要約】バラスト水記録の欠落日。内部監査サンプル候補。',
   'Verify BWRB daily review signature by chief officer.',
   'Sample last two voyages BWRB entries for continuity.',
   'Complete BWRB with chief officer sign-off.'),

  ('33333333-3333-4333-8333-333333333316',
   '[Internal] Repeated lube oil sample overdue - root cause too general; preventive weak.',
   'To: Chief Engineer - revise preventive action with automated PMS reminder and responsible rank.',
   null,
   'Training: PMS oil sample scheduling.',
   '【船主向け要約】潤滑油分析期限超過の再発。PMS改善を依頼。',
   'Add auxiliary engine lube oil sample interval to internal audit checklist.',
   'Verify PMS job completion records for A/E oil samples.',
   'Oil sample report; PMS job closure printout.')
on conflict (deficiency_id) do nothing;

-- ---------------------------------------------------------------------------
-- approvals (sample read-only history)
-- ---------------------------------------------------------------------------
insert into public.approvals (
  deficiency_id, approval_type, status, decided_by, decision_date, comment
)
values
  ('33333333-3333-4333-8333-333333333301', 'supervisor', 'approved', 'Demo Superintendent A', '2025-11-12', 'Routine closure.'),
  ('33333333-3333-4333-8333-333333333301', 'dp', 'approved', 'Demo DP Reviewer', '2025-11-13', null),
  ('33333333-3333-4333-8333-333333333305', 'supervisor', 'pending', null, null, 'Awaiting master revision.'),
  ('33333333-3333-4333-8333-333333333310', 'supervisor', 'approved', 'Demo Superintendent B', '2026-03-01', 'Fleet bulletin follow-up required.')
on conflict do nothing;
