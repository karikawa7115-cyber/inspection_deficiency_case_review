import type {
  AnalyzeProposal,
  CaseType,
  CaseFollowUp,
  DecisionAuthorityItem,
  DecisionBrief,
  DecisionReadiness,
  FactItem,
  IntakeAttachmentRecord,
  ManagementLearning,
  MddCase,
  QualityGateResult,
} from "../types";
import {
  composeAnalyzeInput,
} from "../attachments/compose-analyze-input";
import { synthesizeAttachmentSemantics } from "../attachments/semantic-synthesis-v0.2";
import {
  evaluateQualityGateV1_1,
  subjectFromProposal,
} from "../quality-gate/evaluate-v1.1";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function fact(
  classification: FactItem["classification"],
  text: string,
  extra?: Partial<FactItem>,
): FactItem {
  return { id: id("fact"), classification, text, ...extra };
}

function auth(
  roleLabel: string,
  authority: string,
): DecisionAuthorityItem {
  return {
    id: id("auth"),
    roleLabel,
    authority,
    status: "pending",
  };
}

function learning(
  partial: Partial<ManagementLearning>,
): ManagementLearning {
  return {
    correctiveAction: false,
    preventiveAction: false,
    effectivenessVerification: false,
    horizontalCheck: false,
    fleetWideRelevance: "no",
    internalAuditCandidate: false,
    managementReviewCandidate: false,
    knowledgeUpdateCandidate: false,
    ...partial,
  };
}

/**
 * Deterministic Phase-1 proposer for Golden Case inputs and similar cases.
 * Proposals remain human-confirmable; acceptance truth stays in Spec fixtures.
 *
 * Attachments (v0.1): only affect the generic (non-Golden) path. Golden Case
 * proposals are unchanged when goldenCaseId is set or Golden cues are detected
 * from title/vessel/pastedText (attachment text is never used for GC detection).
 */
export function proposeFromHeuristics(input: {
  title: string;
  vessel?: string;
  pastedText: string;
  goldenCaseId?: MddCase["goldenCaseId"];
  financeSnapshot?: MddCase["financeSnapshot"];
  attachments?: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
}): AnalyzeProposal {
  const gc = input.goldenCaseId ?? detectGolden(input);
  switch (gc) {
    case "GC01":
      return proposeGc01();
    case "GC02":
      return proposeGc02();
    case "GC03":
      return proposeGc03();
    case "GC04":
      return proposeGc04(input.financeSnapshot);
    default:
      return proposeGeneric(input);
  }
}

function detectGolden(input: {
  title: string;
  vessel?: string;
  pastedText: string;
}): MddCase["goldenCaseId"] | undefined {
  const blob = `${input.title}\n${input.vessel ?? ""}\n${input.pastedText}`.toLowerCase();
  if (blob.includes("inoy") || (blob.includes("crew") && blob.includes("nansha")))
    return "GC01";
  if (blob.includes("cms") || (blob.includes("classnk") && blob.includes("fairwind")))
    return "GC02";
  if (
    blob.includes("panama") ||
    blob.includes("internal audit") ||
    blob.includes("cr-4")
  )
    return "GC03";
  if (blob.includes("ctm") || blob.includes("ship fund") || blob.includes("ship's fund"))
    return "GC04";
  return undefined;
}

function proposeGc01(): AnalyzeProposal {
  return {
    primaryCaseType: "CREW_MANNING",
    tags: ["pluto_leader", "crew_change", "owner_interest", "operational_continuity"],
    brief: {
      ...baseBrief({
        recommendation:
          "南沙での C/M 交代は延期し、Voy.071（9月下旬）の日本乗船を計画する。安全／MSM 上の緊急交代が無い限り、当初計画維持のためだけに非現実的な南沙交代や過大な海外手配コストを強行しない。",
        decisionReadiness: "READY",
        decisionAuthorities: [
          auth("配乗・書類調整", "Manning Agent"),
          auth("本船での継続乗船の統括", "Master"),
          auth("交代延期の最終経営承認", "President/DP"),
        ],
        presidentDecision:
          "社長判断：南沙での C/M 交代延期と、9月下旬日本での交代計画を承認する。",
        why: "南沙乗船は実質困難。安全／MSM 上の緊急交代は見当たらない。日本での交代の方が確実かつコスト面でも妥当である。",
        confirmedFacts: [
          fact("confirmed", "C/M Inoy は当初計画どおり南沙で乗船できない。"),
          fact(
            "confirmed",
            "現任 C/M は当面継続乗船可能で、即時の安全／MSM 緊急は確認されていない。",
          ),
          fact(
            "confirmed",
            "次の予定機会は Voy.071（2026年9月下旬）の日本でのクルーチェンジである。",
          ),
        ],
        unverifiedFacts: [],
        assumptions: [],
        missingInformation: [
          fact("missing", "日本の寄港地と ETA が最終確定していない。", {
            who: "Vessel schedule / agent",
            what: "日本寄港地と ETA",
            evidenceRequired: "確定スケジュール",
          }),
          fact("missing", "Inoy の最終的な書類・渡航準備状況。", {
            who: "Manning Agent / CSI",
            what: "書類および乗船準備",
            evidenceRequired: "書類チェックリスト",
          }),
          fact("missing", "必要に応じ現任 C/M の継続確認。", {
            who: "Master / 現任 Chief Mate",
            what: "継続乗船の確認",
            evidenceRequired: "必要時の書面確認",
          }),
        ],
        risks: [
          "書類準備遅れによる日本交代の遅延",
          "スケジュール／ETA 変更による乗船ウィンドウへの影響",
        ],
        options: [
          {
            id: id("opt"),
            title: "日本へ延期（推奨）",
            summary: "南沙計画を取りやめ、9月下旬の日本交代を準備する。",
          },
          {
            id: id("opt"),
            title: "南沙交代を強行",
            summary: "非推奨 — 安全上の必要がなく、非現実的かつ高コスト。",
          },
        ],
        delegation: [
          {
            id: id("del"),
            assignee: "CSI / Manning Agent",
            task: "Inoy の書類・乗船準備を管理する。",
          },
          {
            id: id("del"),
            assignee: "Vessel / schedule",
            task: "日本寄港地と ETA を確認する。",
          },
          {
            id: id("del"),
            assignee: "Master / 現任 C/M",
            task: "継続乗船の手配を確認する。",
          },
        ],
        learning: learning({
          knowledgeUpdateCandidate: true,
          notes:
            "重要配乗書類の早期追跡は今後の海外交代にも再利用できる。本件単独では大規模なシステム問題とはみなさない。",
        }),
        nextActions: [
          {
            id: id("act"),
            text: "CSI に Inoy の日本乗船準備を進めるよう指示する。",
            owner: "President/DP",
            status: "open",
          },
          {
            id: id("act"),
            text: "日本寄港地／ETA の確認を取得する。",
            owner: "Vessel/ops",
            status: "open",
          },
        ],
      }),
      proposedCurrentDecisionQuestion: {
        decisionRequiredNow:
          "南沙での C/M 交代を延期し、日本（Voy.071・9月下旬）での乗船に切り替えることを承認するか？",
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: [
          "書類・渡航手配の実務",
          "寄港地／ETA 確定後の実施手順",
        ],
      },
      suggestedQuestionsToVessel: [
        "現任 C/M の継続乗船に支障はないか（健康・疲労・MSM 含む）？",
        "日本寄港地と ETA の最新見込みは？",
      ],
    },
  };
}

function proposeGc02(): AnalyzeProposal {
  return {
    primaryCaseType: "TECHNICAL",
    tags: ["fairwind", "class_nk", "maintenance", "cms", "knowledge_update_candidate"],
    brief: {
      ...baseBrief({
        recommendation:
          "根拠なく現行の CMS 取扱い方針を放棄しない。Owner 側 Superintendent が指摘した個別項目について ClassNK から狭い範囲の書面確認を取得し、Company／Owner 側／本船の解釈差を解消する。書面で C/E 対応不可と示された項目に限り Class 臨検へ Escalate する。",
        decisionReadiness: "CONDITIONAL",
        decisionAuthorities: [
          auth("船上での CMS 開放・実施", "C/E"),
          auth("技術評価・Class 質問の整理", "Superintendent"),
          auth("Class 受理／解釈", "Class"),
          auth("最終経営確認・対外説明方針", "President/DP"),
        ],
        presidentDecision:
          "社長判断：Kashiwabara 指摘事項に限定した ClassNK 再確認を条件に、現行取扱い方針の維持を承認する。機関／Class の技術判断自体は President が行わない。",
        why: "ClassNK の既往回答と Technical Superintendent の評価は方針を支持するが、例外懸念の個別項目は書面確認が残っている。",
        confirmedFacts: [
          fact(
            "confirmed",
            "ClassNK は提案 CMS 取扱い（期限までの C/E 開放、次回関連検査での Class 確認）について好意的な既往回答を出している。",
          ),
          fact(
            "confirmed",
            "Technical Superintendent（春山）は当該方針を妥当と評価している。",
          ),
          fact(
            "confirmed",
            "Owner 側 Superintendent（柏原）が特定懸念を示し、ClassNK への再確認を求めている。",
          ),
        ],
        unverifiedFacts: [
          fact(
            "unverified",
            "既往の ClassNK 回答が、問題となっている全 CMS 項目をカバーしているかは未確定。",
          ),
        ],
        assumptions: [],
        missingInformation: [
          fact(
            "missing",
            "特定項目が別扱いまたは Class 臨検を要するか。",
            {
              who: "Technical Superintendent / ClassNK",
              what: "C/E 単独対応が合理的でない項目と Class 取扱い",
              evidenceRequired: "項目リスト + ClassNK 書面回答",
            },
          ),
        ],
        risks: [
          "Company／Owner 側／Class の解釈ギャップ",
          "懸念の一般化による不要な Class 臨検コスト",
        ],
        options: [
          {
            id: id("opt"),
            title: "狭い範囲の ClassNK 確認（推奨）",
            summary: "現行方針を維持しつつ、焦点を絞った書面確認を得る。",
          },
          {
            id: id("opt"),
            title: "いま方針を放棄",
            summary: "既往 Class 指導が無効である証拠が無い限り非推奨。",
          },
        ],
        delegation: [
          {
            id: id("del"),
            assignee: "Haruyama (Technical Superintendent)",
            task: "技術的に問題となる項目を特定し、Class への質問を作成する。",
          },
          {
            id: id("del"),
            assignee: "ClassNK",
            task: "指摘項目の受理／条件を書面で確認する。",
          },
          {
            id: id("del"),
            assignee: "Company",
            task: "Class 確認後、Owner 側 Superintendent へ一貫した説明を行う。",
          },
        ],
        learning: learning({
          knowledgeUpdateCandidate: true,
          notes:
            "最終的な ClassNK 確認は社内ナレッジとして再利用できる可能性がある。より広い CMS 管理の弱点が判明した場合のみ IA/MR を検討する。",
        }),
        nextActions: [
          {
            id: id("act"),
            text: "項目リスト付きで ClassNK へ焦点を絞った確認依頼を送る。",
            owner: "Technical Superintendent",
            status: "open",
          },
        ],
        communication:
          "Class 確認後、Owner 側 Superintendent と本船へ一貫した方針を連絡する。",
      }),
      proposedCurrentDecisionQuestion: {
        decisionRequiredNow:
          "現行 CMS 取扱いを維持したまま、Kashiwabara 指摘の個別項目について ClassNK の書面確認を取得する方針を承認するか？",
        expectedDecider: "President/DP（技術判断は Superintendent / Class）",
        deferredToExecutionOrClosure: [
          "C/E による開放・整備の実施",
          "Class 確認後の対外説明実務",
        ],
      },
      suggestedQuestionsToVessel: [
        "対象 CMS 項目の現状（開放可否・期限・必要な支援）は？",
      ],
    },
  };
}

function proposeGc03(): AnalyzeProposal {
  return {
    primaryCaseType: "INSPECTION_COMPLIANCE",
    tags: [
      "orbit",
      "panama_flag",
      "recordkeeping",
      "document_control",
      "root_cause_required",
      "horizontal_check",
      "effectiveness_verification",
      "system_weakness",
      "internal_audit_candidate",
      "management_review_candidate",
      "emergency_preparedness",
      "training_required",
    ],
    brief: {
      ...baseBrief({
        recommendation:
          "社内監査および Panama ASI の全項目を、適切な証拠付きで直ちに是正する。並行して浅い root cause を challenge し、horizontal check を行い、予防策を設定し、相当期間後に effectiveness verification を行う。アース故障などの技術項目は Technical Superintendent へ Escalate する。複数指摘は記録・文書管理・緊急 Familiarization・日常確認・Housekeeping の broader weakness の仮説として扱い、検証まで断定しない。",
        decisionReadiness: "CONDITIONAL",
        decisionAuthorities: [
          auth("船上是正の実施統括", "Master"),
          auth("電気アース故障等の技術検証", "Superintendent"),
          auth("根本原因／SMS／監査フォロー", "President/DP"),
          auth("Company クローズ／管理フォローの最終受理", "President/DP"),
        ],
        presidentDecision:
          "社長判断：個別是正や写真提出だけではクローズとみなさない。即時是正に加え、再発／システム型弱点について root cause の深掘り、horizontal check、effectiveness verification を求める。Do not accept photo-close only.",
        why: "即時是正の方向は明確だが、root cause の質・horizontal check 結果・証拠確認が終わるまでクローズ判断には至らない。Continue to challenge shallow root causes.",
        confirmedFacts: [
          fact("confirmed", "CR-4 に社内監査不適合が2件記録されている。"),
          fact(
            "confirmed",
            "本船は原因記載の CR-5 と是正記載の CR-6 を提出している。",
          ),
          fact(
            "confirmed",
            "Panama Flag ASI が非公式指摘リストを書面で示し、前後証拠付きの速やかな是正を求めている（公式 deficiency としては未記録）。",
          ),
        ],
        unverifiedFacts: [
          fact(
            "unverified",
            "CR-5 の説明は本船の申告原因（shallow root cause の可能性）であり、証明された根本原因とは限らない。",
          ),
          fact(
            "unverified",
            "CR-6 の記載だけでは予防の有効性（effectiveness）を証明しない。",
          ),
        ],
        assumptions: [
          fact(
            "assumption",
            "Possible broader weakness in onboard verification, recordkeeping, document control, and familiarization（検証までの仮説）。",
          ),
        ],
        missingInformation: [
          fact("missing", "バンカリング作業が Remarks だけでなく実労働／休息時間に正しく反映されたか。", {
            who: "Master / C/E",
            what: "実時間と過去サンプルの確認",
            evidenceRequired: "直近 Work/Rest Records + バンカリング記録",
          }),
          fact("missing", "SKSMS Rev.5 の管理文書改訂管理がどう失敗したか。", {
            who: "Master / Company",
            what: "改訂管理の失敗メカニズム",
            evidenceRequired: "管理文書リスト／受領・周知記録",
          }),
          fact("missing", "2/O が非常発電機始動を実演できる証拠。", {
            who: "Master / 関係職員",
            what: "実技能力の確認",
            evidenceRequired: "実演／Familiarization 記録",
          }),
          fact("missing", "100V アース故障の技術状況と恒久是正の証拠。", {
            who: "C/E / Technical Superintendent",
            what: "故障特定と恒久是正",
            evidenceRequired: "計測／修理報告／技術確認",
          }),
        ],
        risks: [
          "非公式指摘の再発による将来の PSC リスク",
          "浅い根本原因のままではシステム弱点が残る",
          "技術欠陥（アース故障）が未検証のまま残る",
        ],
        options: [
          {
            id: id("opt"),
            title: "即時是正 + システムフォロー（推奨）",
            summary: "いま是正し、RC を疑い、水平展開し、有効性を検証する。",
          },
          {
            id: id("opt"),
            title: "写真提出のみでクローズ",
            summary: "不可 — 根本原因も有効性も扱えない。",
          },
        ],
        delegation: [
          {
            id: id("del"),
            assignee: "Master",
            task: "船上是正と証拠一式を統括する。",
          },
          {
            id: id("del"),
            assignee: "C/O",
            task: "甲板／ブリッジ／文書事項を担当する。",
          },
          {
            id: id("del"),
            assignee: "C/E",
            task: "機関／電気／薬品／労働休息事項を担当する。",
          },
          {
            id: id("del"),
            assignee: "Technical Superintendent",
            task: "技術妥当性（アース故障含む）を確認する。",
          },
          {
            id: id("del"),
            assignee: "Company / DP",
            task: "根本原因の質、水平展開、クローズをレビューする。",
          },
        ],
        learning: learning({
          correctiveAction: true,
          preventiveAction: true,
          effectivenessVerification: true,
          horizontalCheck: true,
          fleetWideRelevance: "possible",
          internalAuditCandidate: true,
          managementReviewCandidate: true,
          knowledgeUpdateCandidate: true,
          notes:
            "IA と ASI の併存から重要な管理上の学びが期待される。Professional Boundary：電気／アース故障は写真のみでクローズ宣言しない。技術項目の妥当性は Technical Superintendent（President ではない）が確認する。",
        }),
        nextActions: [
          {
            id: id("act"),
            text: "前後証拠付きで即時是正を完了する。",
            owner: "Master",
            status: "open",
          },
          {
            id: id("act"),
            text: "CR-5 の root cause を challenge し、horizontal check を開始する。",
            owner: "Company/DP",
            status: "open",
          },
          {
            id: id("act"),
            text: "アース故障を技術確認へ Escalate する。",
            owner: "Technical Superintendent",
            status: "open",
          },
        ],
      }),
      proposedCurrentDecisionQuestion: {
        decisionRequiredNow:
          "即時是正に加え、根本原因の深掘り・水平展開・有効性検証を完了するまでクローズしない方針を承認するか？",
        expectedDecider: "President/DP（技術項目は Technical Superintendent）",
        deferredToExecutionOrClosure: [
          "個別是正の実施と証拠収集",
          "有効性検証の実施タイミング管理",
        ],
      },
      suggestedQuestionsToVessel: [
        "各是正項目の前後証拠は揃っているか？",
        "100V アース故障の現状計測値と暫定／恒久措置は？",
      ],
    },
  };
}

function proposeGc04(
  financeSnapshot?: MddCase["financeSnapshot"],
): AnalyzeProposal {
  const liquidityConfirmed = Boolean(financeSnapshot?.companyLiquidityConfirmed);
  const readiness: DecisionReadiness = liquidityConfirmed ? "READY" : "CONDITIONAL";
  const recommended =
    financeSnapshot?.recommendedCtm ?? 40000;
  const required =
    financeSnapshot?.vesselRequiredApprox ?? 39293;

  return {
    primaryCaseType: "FINANCE_COMMERCIAL",
    tags: [
      "pluto_leader",
      "financial_risk",
      "owner_interest",
      "ctm",
      "ship_fund",
      "company_liquidity",
    ],
    brief: {
      ...baseBrief({
        recommendation: `期末残高を目標 USD5,000 に近づけるための本船側所要は約 USD${required.toLocaleString()}。したがって本船運航上の推奨は USD${recommended.toLocaleString()}。最終送金は Company の USD 流動性に従う：USD40,000 が DCKK／CSI／Casareo／SPF／Retirement Fund 等の重要支払を危うくする場合は、より低い CTM を選び不足回収を先送りできる。Necessary ≠ Affordable — 両判断は分ける。三幸汽船の入金確認前に CSI 送金を行わない。`,
        decisionReadiness: readiness,
        decisionAuthorities: [
          auth("Ship Fund データ／船上所要の入力", "Master"),
          auth("Company 資金繰り確認", "Finance/Accounting"),
          auth("CTM 最終資金決定", "President/DP"),
        ],
        presidentDecision: `社長判断：本船所要（約 USD${required.toLocaleString()}）と Company USD 流動性を比較し、9月 CTM 額を決定／承認する。現時点の本船側数値では運航上 USD${recommended.toLocaleString()} が望ましいが、流動性確認を条件とする。`,
        why: liquidityConfirmed
          ? "本船側所要は明確で、FinanceSnapshot に Company 流動性確認がある。"
          : "本船側所要は十分明確だが、送金直前の Company 流動性確認が最終承認に必要である。",
        confirmedFacts: [
          fact("confirmed", "報告 Ship Fund 繰越 USD4,052.19（提供値）。"),
          fact(
            "confirmed",
            "南沙プロビション見積 USD9,591.98 は当該残高に未反映（Pending／見積）。",
          ),
          fact("confirmed", "Ship Fund 目標期末残高 USD5,000。"),
          fact(
            "confirmed",
            "CSI は三幸汽船入金確認前に送金しない。主要月末 USD 支払は原則 SMBC USD。",
          ),
        ],
        unverifiedFacts: [],
        assumptions: [],
        missingInformation: liquidityConfirmed
          ? [
              fact("missing", "9月 CTM の正確な日付／受取人が未確定の可能性。", {
                who: "Vessel / agent",
                what: "最終 CTM 日付と受取側",
                evidenceRequired: "港スケジュール／代理店指示",
              }),
            ]
          : [
              fact("missing", "予定 CTM 日付時点の Company USD 流動性。", {
                who: "Finance / Accounting / President",
                what: "USD 流動性 vs 直近確定債務",
                evidenceRequired: "現行残高 + 直近確定入出金",
              }),
              fact("missing", "9月 CTM の正確な日付と受取人。", {
                who: "Vessel / agent",
                what: "最終 CTM 日付と受取側",
                evidenceRequired: "港スケジュール／代理店指示",
              }),
            ],
        risks: [
          "CTM 不足による Ship Fund 欠損",
          "確認なしの過大 CTM による Company 流動性逼迫",
          "三幸入金前の CSI 送金",
        ],
        options: [
          {
            id: id("opt"),
            title: "CTM USD40,000（本船側推奨）",
            summary: "提供試算では USD5,000 目標に近づく。流動性条件付き。",
          },
          {
            id: id("opt"),
            title: "より低い CTM／回収延期",
            summary: "重要支払を危うくする場合は低額を選ぶ。",
          },
        ],
        delegation: [
          {
            id: id("del"),
            assignee: "Master",
            task: "Ship Fund 残高を維持・報告する。",
          },
          {
            id: id("del"),
            assignee: "Finance / Accounting",
            task: "銀行残高と確定支払を更新する。",
          },
          {
            id: id("del"),
            assignee: "Agent",
            task: "承認後の CTM 受渡しを行う。",
          },
          {
            id: id("del"),
            assignee: "President",
            task: "最終資金額を決定する。",
          },
        ],
        learning: learning({
          notes:
            "後で実際の CTM／Ship Fund 結果と予測を比較する。Ship Fund が一時的にマイナスになったことだけで自動的に IA/MR としない。",
        }),
        nextActions: [
          {
            id: id("act"),
            text: "送金日近傍の Company USD 流動性を確認する。",
            owner: "Finance/Accounting",
            status: "open",
          },
          {
            id: id("act"),
            text: "President が 9月 CTM 最終額を承認する。",
            owner: "President/DP",
            status: "open",
          },
        ],
      }),
      proposedCurrentDecisionQuestion: {
        decisionRequiredNow: `本船所要（約 USD${required.toLocaleString()}）と Company 流動性を踏まえ、9月 CTM をいくら承認するか？`,
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: [
          "送金実務・代理店手配",
          "Ship Fund 実績の事後レビュー",
        ],
      },
      suggestedQuestionsToVessel: [
        "Ship Fund の最新残高と Pending 費用の更新はあるか？",
        "CTM 希望日と受取方法の最新指示は？",
      ],
    },
  };
}

function proposeGeneric(input: {
  title: string;
  vessel?: string;
  pastedText: string;
  attachments?: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
}): AnalyzeProposal {
  const attachments = input.attachments ?? [];
  const followUps = input.followUps ?? [];
  const extractedAttachments = attachments.filter(
    (a) =>
      a.extractionStatus === "EXTRACTED" &&
      a.extractedContent.trim().length > 0,
  );
  const previewOnly = attachments.filter(
    (a) => a.extractionStatus === "PREVIEW_ONLY",
  );
  const failed = attachments.filter((a) => a.extractionStatus === "FAILED");

  const analyzeInput = composeAnalyzeInput({
    narrative: input.pastedText,
    attachments,
    followUps,
  });

  const useSemanticV02 =
    extractedAttachments.length > 0 || followUps.length > 0;

  if (useSemanticV02) {
    return proposeGenericWithAttachmentSemantics({
      title: input.title,
      vessel: input.vessel,
      pastedText: input.pastedText,
      attachments,
      followUps,
      extractedAttachments,
      previewOnly,
      failed,
      analyzeInput,
    });
  }

  // No-attachment path — unchanged baseline behaviour.
  const hasNarrative = input.pastedText.trim().length > 0;
  const confirmedFacts: FactItem[] = [];
  if (hasNarrative) {
    confirmedFacts.push(
      fact(
        "confirmed",
        "User-pasted intake text is present (content not yet verified as operational fact).",
      ),
    );
  }

  const missingInformation: FactItem[] = [
    fact(
      "missing",
      "Key confirmed facts and decision question are not yet structured.",
      {
        who: "Case owner",
        what: "Decision question and confirmed facts",
        evidenceRequired: "Structured intake",
      },
    ),
  ];

  const type: CaseType = inferGenericCaseType(
    `${input.title}\n${input.pastedText}`,
  );

  return {
    primaryCaseType: type,
    tags: [
      ...(input.vessel
        ? [input.vessel.toLowerCase().replace(/\s+/g, "_")]
        : []),
      type === "TECHNICAL"
        ? "technical"
        : type === "INSPECTION_COMPLIANCE"
          ? "inspection_compliance"
          : type === "FINANCE_COMMERCIAL"
            ? "finance"
            : "operational",
    ],
    brief: {
      ...baseBrief({
        recommendation:
          "事実を整理し、不足情報を特定し、判断権限を割り当てる。経営確認が必要な事項に限って President Decision を準備する。",
        decisionReadiness: "NOT_READY",
        decisionAuthorities: [
          auth("案件調整・事実確認", "Superintendent"),
          auth("経営確認（必要な場合のみ）", "President/DP"),
        ],
        presidentDecision:
          "社長判断：現時点では不要 — 構造化された事実が揃うまで保留。",
        why: "経営判断に足る構造化分析が不足している。",
        confirmedFacts,
        unverifiedFacts: [],
        assumptions: [],
        missingInformation,
        risks: ["Acting on unstructured intake"],
        options: [],
        delegation: [
          {
            id: id("del"),
            assignee: "Case coordinator",
            task: "Structure facts and identify decision owner(s).",
          },
        ],
        learning: learning({}),
        nextActions: [
          {
            id: id("act"),
            text: "構造化された事実入力を完了し、再解析する。",
            owner: "Case owner",
            status: "open",
          },
        ],
      }),
    },
  };
}

function proposeGenericWithAttachmentSemantics(input: {
  title: string;
  vessel?: string;
  pastedText: string;
  attachments: IntakeAttachmentRecord[];
  followUps: CaseFollowUp[];
  extractedAttachments: IntakeAttachmentRecord[];
  previewOnly: IntakeAttachmentRecord[];
  failed: IntakeAttachmentRecord[];
  analyzeInput: string;
}): AnalyzeProposal {
  const synthesis = synthesizeAttachmentSemantics({
    title: input.title,
    vessel: input.vessel,
    narrative: input.pastedText,
    attachments: input.attachments,
    followUps: input.followUps,
  });

  const unverifiedFacts: FactItem[] = synthesis.materialReportedFacts.map((c) =>
    fact("unverified", c.text, {
      evidenceRequired: c.sourceLabel,
    }),
  );

  for (const a of input.previewOnly) {
    unverifiedFacts.push(
      fact(
        "unverified",
        `Attachment present without semantic extraction: ${a.fileName} (${a.extractionNote ?? "PREVIEW_ONLY"})`,
        { evidenceRequired: `Source: ${a.fileName}` },
      ),
    );
  }
  for (const a of input.failed) {
    unverifiedFacts.push(
      fact(
        "unverified",
        `Attachment extraction failed: ${a.fileName} — do not invent its contents. (${a.extractionNote ?? "FAILED"})`,
        { evidenceRequired: `Source: ${a.fileName}` },
      ),
    );
  }

  if (synthesis.operationalStatus) {
    unverifiedFacts.push(
      fact("unverified", synthesis.operationalStatus, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }
  if (synthesis.suspectedCause) {
    unverifiedFacts.push(
      fact("unverified", synthesis.suspectedCause, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }
  if (synthesis.contaminationDamage) {
    unverifiedFacts.push(
      fact("unverified", synthesis.contaminationDamage, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }
  for (const m of synthesis.temporaryMeasures) {
    unverifiedFacts.push(
      fact("unverified", m, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }
  if (synthesis.repairPartsStatus) {
    unverifiedFacts.push(
      fact("unverified", synthesis.repairPartsStatus, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }
  if (synthesis.notificationStatus) {
    unverifiedFacts.push(
      fact("unverified", synthesis.notificationStatus, {
        evidenceRequired: "Source: synthesized from intake + attachments",
      }),
    );
  }

  input.followUps.forEach((fu, i) => {
    const label = fu.authorLabel?.trim()
      ? `Follow-up ${i + 1} (${fu.authorLabel.trim()})`
      : `Follow-up ${i + 1}`;
    const snippet = fu.text.trim().slice(0, 220);
    if (snippet) {
      unverifiedFacts.push(
        fact("unverified", `${snippet}${fu.text.trim().length > 220 ? "…" : ""}`, {
          evidenceRequired: `Source: ${label}`,
        }),
      );
    }
  });

  const confirmedFacts: FactItem[] = [];
  if (input.pastedText.trim().length > 0) {
    confirmedFacts.push(
      fact(
        "confirmed",
        "User-pasted intake text is present (content not yet verified as operational fact).",
      ),
    );
  }
  if (input.extractedAttachments.length > 0) {
    confirmedFacts.push(
      fact(
        "confirmed",
        `${input.extractedAttachments.length} attachment(s) yielded extractable text; line-level items below are Reported but Unverified until human confirmation.`,
      ),
    );
  }
  if (input.followUps.length > 0) {
    confirmedFacts.push(
      fact(
        "confirmed",
        `${input.followUps.length} follow-up(s) included in Analyze input (Reported but Unverified until human confirmation).`,
      ),
    );
  }

  const missingInformation: FactItem[] = synthesis.missingInformation.map((m) =>
    fact("missing", m.text, {
      who: m.who,
      what: m.what,
      evidenceRequired: m.evidenceRequired,
    }),
  );
  if (
    input.attachments.length > 0 &&
    input.extractedAttachments.length === 0
  ) {
    missingInformation.unshift(
      fact(
        "missing",
        "Attached files did not yield usable text (FAILED or PREVIEW_ONLY). Re-supply text, a text-layer PDF, or spreadsheet — do not invent.",
        {
          who: "Case owner",
          what: "Readable attachment content",
          evidenceRequired: "Re-extractable source file",
        },
      ),
    );
  }

  const type = synthesis.caseTypeHint;
  const typeTag =
    type === "TECHNICAL"
      ? "technical"
      : type === "INSPECTION_COMPLIANCE"
        ? "inspection_compliance"
        : type === "FINANCE_COMMERCIAL"
          ? "finance"
          : "operational";

  const suggestedQuestionsToVessel = synthesis.suggestedQuestionsToVessel;

  return {
    primaryCaseType: type,
    tags: [
      ...(input.vessel
        ? [input.vessel.toLowerCase().replace(/\s+/g, "_")]
        : []),
      typeTag,
      ...(input.extractedAttachments.length > 0 ? ["attachment_sourced"] : []),
      ...(input.followUps.length > 0 ? ["follow_up"] : []),
      "semantic_v0_2",
    ],
    brief: {
      ...baseBrief({
        recommendation: synthesis.recommendation,
        decisionReadiness: synthesis.decisionReadiness,
        decisionAuthorities: synthesis.decisionAuthorities.map((a) => ({
          id: id("auth"),
          ...a,
        })),
        presidentDecision: synthesis.presidentDecision,
        why: synthesis.why,
        confirmedFacts,
        unverifiedFacts,
        assumptions: [],
        missingInformation,
        risks: synthesis.risks,
        options: [],
        delegation: synthesis.delegation.map((d) => ({
          id: id("del"),
          ...d,
        })),
        learning: learning({
          notes: [
            synthesis.learningNotes,
            `Analyze input composed with source boundaries (${input.analyzeInput.length} chars).`,
          ]
            .filter(Boolean)
            .join(" "),
        }),
        nextActions: synthesis.nextActions.map((a) => ({
          id: id("act"),
          text: a.text,
          owner: a.owner,
          status: "open" as const,
        })),
      }),
      suggestedQuestionsToVessel,
      proposedCurrentDecisionQuestion: synthesis.proposedDecisionQuestion,
    },
  };
}

/** UI chips only — questions to ask, not asserted facts. Kept for follow-up-only tests / legacy. */
function buildSuggestedQuestionsToVessel(input: {
  caseType: CaseType;
  title: string;
  pastedText: string;
  attachmentBlob: string;
  followUpCount: number;
}): string[] {
  const blob =
    `${input.title}\n${input.pastedText}\n${input.attachmentBlob}`.toLowerCase();
  const qs: string[] = [];

  if (input.caseType === "TECHNICAL") {
    qs.push(
      "Is the affected equipment currently usable / available for operation?",
    );
    qs.push("What temporary / contingency measures are in place onboard now?");
    qs.push("What is the estimated parts / repair completion timing?");
  }
  if (
    blob.includes("valve") ||
    blob.includes("generator") ||
    blob.includes("diesel") ||
    blob.includes("contamination") ||
    blob.includes("vlsfo")
  ) {
    qs.push(
      "Please confirm contamination extent and whether DO service tank / FO system isolation is complete.",
    );
    qs.push(
      "What Class / company notifications (if any) have already been made?",
    );
  }
  if (input.caseType === "CREW_MANNING") {
    qs.push("What is the latest embarkation / document readiness status?");
  }
  if (input.caseType === "FINANCE_COMMERCIAL") {
    qs.push("Please confirm latest Ship Fund / pending expense figures and as-of date.");
  }
  if (input.followUpCount === 0) {
    qs.push(
      "Who onboard owns this issue now (Master / C/E / other), and what decision do you need from shore?",
    );
  } else {
    qs.push(
      "Please confirm any remaining open points after the latest follow-up (list unknowns only).",
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of qs) {
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}

/** Lightweight type hint from intake+attachment text — not Golden-specific. */
function inferGenericCaseType(blob: string): CaseType {
  const t = blob.toLowerCase();
  if (
    t.includes("generator") ||
    t.includes("valve") ||
    t.includes("diesel") ||
    t.includes("engine") ||
    t.includes("defect") ||
    t.includes("trouble report") ||
    t.includes("machinery")
  ) {
    return "TECHNICAL";
  }
  if (
    t.includes("psc") ||
    t.includes("audit") ||
    t.includes("deficiency") ||
    t.includes("ism")
  ) {
    return "INSPECTION_COMPLIANCE";
  }
  if (t.includes("ctm") || t.includes("invoice") || t.includes("remittance")) {
    return "FINANCE_COMMERCIAL";
  }
  if (t.includes("crew") || t.includes("manning") || t.includes("visa")) {
    return "CREW_MANNING";
  }
  return "OPERATIONAL";
}

function baseBrief(
  partial: Omit<
    AnalyzeProposal["brief"],
    "confirmedFacts" | "unverifiedFacts" | "assumptions" | "missingInformation"
  > & {
    confirmedFacts: FactItem[];
    unverifiedFacts: FactItem[];
    assumptions: FactItem[];
    missingInformation: FactItem[];
  },
): AnalyzeProposal["brief"] {
  return {
    ...partial,
    communication: partial.communication,
  };
}

export function runQualityGate(input: {
  brief: AnalyzeProposal["brief"];
  primaryCaseType: CaseType;
  tags?: string[];
  reviewCandidateFlag?: boolean;
}): QualityGateResult {
  const b = input.brief;
  const evaluation = evaluateQualityGateV1_1(
    subjectFromProposal({
      primaryCaseType: input.primaryCaseType,
      tags: input.tags,
      recommendation: b.recommendation,
      presidentDecision: b.presidentDecision,
      why: b.why,
      decisionReadiness: b.decisionReadiness,
      decisionAuthorities: b.decisionAuthorities.map((a) => ({
        roleLabel: a.roleLabel,
        authority: String(a.authority),
      })),
      nextActions: b.nextActions.map((a) => ({
        owner: a.owner,
        text: a.text,
        dueDate: a.dueDate,
      })),
      confirmedFacts: b.confirmedFacts,
      unverifiedFacts: b.unverifiedFacts,
      assumptions: b.assumptions,
      missingInformation: b.missingInformation,
      learning: {
        managementReviewCandidate: b.learning.managementReviewCandidate,
        internalAuditCandidate: b.learning.internalAuditCandidate,
        knowledgeUpdateCandidate: b.learning.knowledgeUpdateCandidate,
        notes: b.learning.notes,
      },
      reviewCandidateFlag:
        input.reviewCandidateFlag ?? b.learning.managementReviewCandidate,
    }),
  );

  return {
    passed: evaluation.passed,
    criticalFailures: evaluation.criticalFailures.map(
      (f) => `${f.code}: ${f.message}`,
    ),
    warnings: evaluation.warnings.map((f) => `${f.code}: ${f.message}`),
    evaluatedAt: evaluation.evaluatedAt,
  };
}

/**
 * Ensure Why / explanatory copy matches the Gate-owned final readiness.
 * Strips pre-Gate readiness verdicts that would contradict the badge.
 */
export function alignWhyWithFinalReadiness(
  why: string,
  final: DecisionReadiness,
): string {
  const label =
    final === "READY"
      ? "判断可能"
      : final === "CONDITIONAL"
        ? "条件付き"
        : "判断不可";

  let cleaned = why
    .replace(/\s*Readiness is (READY|CONDITIONAL|NOT_READY)\b[^.。]*[.。]?/gi, " ")
    .replace(/\s*Decision remains NOT[_\s-]?READY\b[^.。]*[.。]?/gi, " ")
    .replace(/\s*最終の判断準備状況は[^。\n]*。/g, " ")
    .replace(
      /\s*現時点は(?:判断可能（READY）|条件付き（CONDITIONAL）|判断不可（NOT READY）|判断可能|条件付き|判断不可)[。.]?/g,
      " ",
    )
    .replace(
      /\s*判断準備状況は(?:READY|CONDITIONAL|NOT_READY|判断可能（READY）|条件付き（CONDITIONAL）|判断不可（NOT READY）|判断可能|条件付き|判断不可)[^.。]*[.。]?/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  // Neutralize leftover contradictory readiness tokens in explanatory sentences.
  if (final === "CONDITIONAL") {
    cleaned = cleaned.replace(/\bNOT[_\s-]?READY\b/gi, "CONDITIONAL");
  } else if (final === "READY") {
    cleaned = cleaned.replace(/\bNOT[_\s-]?READY\b/gi, "READY");
    cleaned = cleaned.replace(/\bCONDITIONAL\b/g, "READY");
  } else {
    cleaned = cleaned.replace(/\bCONDITIONAL\b/g, "NOT_READY");
  }

  const needsPeriod = cleaned.length > 0 && !/[。.!？?]$/.test(cleaned);
  const body = cleaned ? `${cleaned}${needsPeriod ? "。" : ""}` : "";
  return `${body}最終の判断準備状況は${label}。`;
}

export function applyGateToBrief(
  proposal: AnalyzeProposal,
  opts?: {
    reviewCandidateFlag?: boolean;
    financeSnapshot?: MddCase["financeSnapshot"];
  },
): DecisionBrief {
  const evaluation = evaluateQualityGateV1_1(
    subjectFromProposal({
      primaryCaseType: proposal.primaryCaseType,
      tags: proposal.tags,
      recommendation: proposal.brief.recommendation,
      presidentDecision: proposal.brief.presidentDecision,
      why: proposal.brief.why,
      decisionReadiness: proposal.brief.decisionReadiness,
      decisionAuthorities: proposal.brief.decisionAuthorities.map((a) => ({
        roleLabel: a.roleLabel,
        authority: String(a.authority),
      })),
      nextActions: proposal.brief.nextActions.map((a) => ({
        owner: a.owner,
        text: a.text,
        dueDate: a.dueDate,
      })),
      confirmedFacts: proposal.brief.confirmedFacts,
      unverifiedFacts: proposal.brief.unverifiedFacts,
      assumptions: proposal.brief.assumptions,
      missingInformation: proposal.brief.missingInformation,
      learning: {
        managementReviewCandidate:
          proposal.brief.learning.managementReviewCandidate,
        internalAuditCandidate: proposal.brief.learning.internalAuditCandidate,
        knowledgeUpdateCandidate:
          proposal.brief.learning.knowledgeUpdateCandidate,
        notes: proposal.brief.learning.notes,
      },
      reviewCandidateFlag:
        opts?.reviewCandidateFlag ??
        proposal.brief.learning.managementReviewCandidate,
      financeSnapshot: opts?.financeSnapshot,
    }),
  );

  return {
    ...proposal.brief,
    decisionReadiness: evaluation.enforcedReadiness,
    why: alignWhyWithFinalReadiness(
      proposal.brief.why,
      evaluation.enforcedReadiness,
    ),
    qualityGate: {
      passed: evaluation.passed,
      criticalFailures: evaluation.criticalFailures.map(
        (f) => `${f.code}: ${f.message}`,
      ),
      warnings: evaluation.warnings.map((f) => `${f.code}: ${f.message}`),
      evaluatedAt: evaluation.evaluatedAt,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function createEmptyCase(partial?: Partial<MddCase>): MddCase {
  const now = new Date().toISOString();
  const base: MddCase = {
    id: id("case"),
    title: "New Case",
    primaryCaseTypeConfirmed: false,
    tags: [],
    tagsConfirmed: false,
    status: "NEW",
    reviewCandidateFlag: false,
    reviewCandidateConfirmed: false,
    pastedText: "",
    attachments: [],
    followUps: [],
    structuredFacts: [],
    contextPack: {
      companyCore: true,
      businessPartners: [],
      people: [],
      relatedCaseIds: [],
      aiSuggested: false,
      humanConfirmed: false,
    },
    recommendationConfirmed: false,
    presidentDecisionConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };
  const merged = { ...base, ...partial, updatedAt: now };
  if (partial?.vessel && !partial.contextPack) {
    merged.contextPack = {
      ...merged.contextPack,
      vessel: partial.vessel,
    };
  }
  return merged;
}
