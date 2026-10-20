export const meta = {
  name: 'temple-portal-brain-build',
  description: 'Build and verify 15 module brain files for the temple-portal repo, then synthesise the expert skill, overview docs + HTML brief, React Native/faults report and UI redesign plan, each with an adversarial review',
  phases: [
    { title: 'Inventory', detail: 'one Sonnet agent scripts the file, export and import inventory', model: 'sonnet' },
    { title: 'Build', detail: 'one Opus-high analyst per module writes its brain file', model: 'opus' },
    { title: 'Verify', detail: 'one Opus-high skeptic per module refutes and corrects the brain file', model: 'opus' },
    { title: 'Synthesise', detail: 'expert skill + mind map, overview docs then HTML brief, RN/faults report, UI redesign plan', model: 'opus' },
    { title: 'Review', detail: 'skill QA, docs review, report skeptic, redesign critic', model: 'opus' },
  ],
}

const { chunks, paths, today } = args
const brainFile = c => `${paths.brain}/${c.id}-${c.slug}.md`

// --- compact schema helpers -------------------------------------------------
const S = { type: 'string' }, I = { type: 'integer' }, B = { type: 'boolean' }
const A = items => ({ type: 'array', items })
const O = props => ({ type: 'object', properties: props, required: Object.keys(props) })

const FINDING = O({ id: S, severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, summary: S, evidence: S })

const INVENTORY_SCHEMA = O({ chunks: A(O({ id: S, files: I, lines: I })), unassignedFiles: I, multiAssignedFiles: I, useClientFiles: I, serverOnlyFiles: I, summaryPath: S, notes: S })
const BUILD_SCHEMA = O({ chunk: S, title: S, filesExpected: I, filesMentioned: I, file: S, findings: A(FINDING), portabilitySummary: S, unclear: A(S), notes: S })
const VERIFY_SCHEMA = O({ chunk: S, pathsChecked: I, pathsBroken: I, pathsFixed: I, claimsSampled: I, claimsConfirmed: I, claimsRefuted: I, claimsUncertain: I, findingsReviewed: I, findingsConfirmed: I, findingsRefuted: I, findingsAdded: I, filesUnmentionedBefore: I, filesAddedToBrain: I, focusQuestionsUnanswered: A(S), file: S, notes: S })
const S1_SCHEMA = O({ outputs: A(S), skillBodyWords: I, modulesMapped: I, routesIndexed: I, storesIndexed: I, glossaryTerms: I, overlaps: A(S), gaps: A(S), notes: S })
const S2_SCHEMA = O({ outputs: A(S), overviewWords: I, guideWords: I, modulesLinked: I, brokenLinks: I, staleDocsFlagged: A(S), unclear: A(S), notes: S })
const S3_SCHEMA = O({ output: S, bytes: I, externalResources: I, redAccentUses: I, sections: A(S), factsCheckedAgainstDocs: I, notes: S })
const S4_SCHEMA = O({ output: S, words: I, faultsTotal: I, faultsBySeverity: O({ HIGH: I, MEDIUM: I, LOW: I }), faultsSpotChecked: I, faultsSpotCheckHeld: I, recommendedOption: S, effortRangeWeeks: O({ low: I, high: I }), modulesRewrite: I, modulesAdapt: I, modulesReuse: I, apiGaps: I, decisionsNeeded: I, notes: S })
const S5_SCHEMA = O({ outputs: A(S), words: I, diagnosisRows: I, primitivesSpecified: I, pagesWireframed: I, referencesCited: I, newColourValuesIntroduced: I, specimenBytes: I, specimenExternalResources: I, openDecisions: A(S), notes: S })
const V1_SCHEMA = O({ questions: I, routedAndCorrect: I, routedButBrainWrong: I, notRoutable: I, answeredFromCodeOnly: I, routingEditsMade: I, brainDefects: A(O({ file: S, section: S, issue: S, evidence: S })), skillBodyWords: I, file: S, notes: S })
const V2_SCHEMA = O({ claimsSampled: I, claimsConfirmed: I, claimsRefuted: I, claimsUncertain: I, divergencesFound: I, divergencesFixed: I, brokenLinks: I, externalResources: I, redAccentUses: I, htmlBytes: I, editsMade: I, file: S, notes: S })
const V3_SCHEMA = O({ rowsSampled: I, rowsHeld: I, rowsRefuted: I, rowsAdded: I, duplicatesFound: I, recommendationStands: B, flipCondition: S, matrixRowsChecked: I, matrixRowsWrong: I, arithmeticErrors: I, editsMade: I, file: S, notes: S })
const V4_SCHEMA = O({ diagnosisChecked: I, diagnosisHeld: I, diagnosisRefuted: I, specsChecked: I, specsImplementable: I, specsFixed: I, newColourValues: I, contrastPairsChecked: I, contrastFailures: I, specimenExternalResources: I, specimenMissingPrimitives: A(S), referencesSpotChecked: I, referencesHeld: I, editsMade: I, file: S, notes: S })

// --- prompts: briefs live on disk, prompts carry paths and the upstream result -----
const head = brief => `Read ${paths.briefs}/RULES.md first, then your brief in full and do exactly what it says: ${paths.briefs}/${brief}. Today is ${today}. Work alone; never ask questions; do not spawn subagents. Your final text is a return value read by a script: return only the structured summary.`

const inventoryPrompt = head('INVENTORY.brief.md')

const buildPrompt = c => `${head('BUILD.brief.md')}
You own chunk ${c.id} - "${c.title}". Your chunk entry is in ${paths.chunks} (id ${c.id}). Your inventory is ${paths.inventory}/${c.id}.json (if it is missing, list your roots yourself).
Write the brain file to ${brainFile(c)}, then return the structured summary.`

const verifyPrompt = (c, built) => `You are the skeptic for chunk ${c.id} - "${c.title}". A builder has written its brain file at ${brainFile(c)}. Your job is to REFUTE its claims against the code, not to agree with them.
${head('VERIFY.brief.md')}
Write your report to ${paths.verify}/${c.id}.md and correct the brain file in place as the brief says, then return the structured summary.
BUILDER RESULT:
${JSON.stringify({ filesExpected: built.filesExpected, filesMentioned: built.filesMentioned, findings: built.findings, unclear: built.unclear, notes: built.notes }, null, 1)}`

const missingNote = missing => missing.length ? `\nNOTE: these brain files were NOT produced and must be listed as gaps, not invented: ${missing.join(', ')}.` : ''

const s1Prompt = missing => `${head('S1-expert-skill.brief.md')}
Brain files are in ${paths.brain}/ (15 expected: ${chunks.map(c => c.id).join(', ')}). Write SKILL.md, MIND-MAP.md and README.md into ${paths.skill}/.${missingNote(missing)}`

const s2Prompt = missing => `${head('S2-overview-docs.brief.md')}
Brain files are in ${paths.brain}/. Write ${paths.overview}/OVERVIEW.md and ${paths.overview}/TECHNICAL-GUIDE.md.${missingNote(missing)}`

const s3Prompt = s2 => `${head('S3-html-brief.brief.md')}
The overview documents were just written; their author reported: ${JSON.stringify({ outputs: s2.outputs, overviewWords: s2.overviewWords, guideWords: s2.guideWords, staleDocsFlagged: s2.staleDocsFlagged, notes: s2.notes })}.
Write ${paths.overview}/temple-portal-brief.html.`

const s4Prompt = missing => `${head('S4-react-native-and-faults-report.brief.md')}
Brain files are in ${paths.brain}/, skeptic reports in ${paths.verify}/. Write ${paths.rearch}/REACT-NATIVE-MIGRATION-AND-FAULTS.md.${missingNote(missing)}`

const s5Prompt = missing => `${head('S5-ui-redesign-plan.brief.md')}
Brain files are in ${paths.brain}/. Write ${paths.rearch}/UI-REDESIGN-PLAN.md and ${paths.rearch}/ui-redesign-specimens.html. WebSearch and WebFetch may need to be loaded with ToolSearch before first use.${missingNote(missing)}`

const v1Prompt = s1 => `You are testing the expert skill as a cold user. ${head('V1-skill-qa.brief.md')}
The skill author reported: ${JSON.stringify({ outputs: s1.outputs, overlaps: s1.overlaps, gaps: s1.gaps, notes: s1.notes })}. Write ${paths.verify}/V1-skill-qa.md.`

const v2Prompt = (s2, s3) => `You are reviewing the overview docs and HTML brief. ${head('V2-docs-review.brief.md')}
Authors reported: ${JSON.stringify({ docs: { outputs: s2.outputs, brokenLinks: s2.brokenLinks, unclear: s2.unclear }, html: s3 ? { output: s3.output, bytes: s3.bytes, externalResources: s3.externalResources, redAccentUses: s3.redAccentUses } : 'HTML agent returned nothing - check whether the file exists' })}. Write ${paths.verify}/V2-docs-review.md.`

const v3Prompt = s4 => `You are the skeptic for the rearchitecture report. Your job is to REFUTE it, not to agree. ${head('V3-report-skeptic.brief.md')}
The author reported: ${JSON.stringify({ output: s4.output, faultsTotal: s4.faultsTotal, faultsBySeverity: s4.faultsBySeverity, recommendedOption: s4.recommendedOption, effortRangeWeeks: s4.effortRangeWeeks, apiGaps: s4.apiGaps, notes: s4.notes })}. Write ${paths.verify}/V3-report-skeptic.md.`

const v4Prompt = s5 => `You are the critic for the UI redesign plan. Break what is weak. ${head('V4-redesign-critic.brief.md')}
The author reported: ${JSON.stringify({ outputs: s5.outputs, diagnosisRows: s5.diagnosisRows, primitivesSpecified: s5.primitivesSpecified, newColourValuesIntroduced: s5.newColourValuesIntroduced, openDecisions: s5.openDecisions, notes: s5.notes })}. Write ${paths.verify}/V4-redesign-critic.md.`

// --- Phase 1: inventory (Sonnet) ---------------------------------------------------
const inv = await agent(inventoryPrompt, { label: 'inventory', phase: 'Inventory', schema: INVENTORY_SCHEMA, model: 'sonnet', effort: 'medium' })
if (inv) log(`inventory: ${inv.chunks.map(c => `${c.id}:${c.files}f`).join(' ')} | unassigned ${inv.unassignedFiles} | use-client ${inv.useClientFiles}`)
else log('inventory agent returned nothing - builders will list their own roots')

// --- Phase 2+3: build then verify, pipelined per chunk (no barrier) ----------------
const chains = await pipeline(chunks,
  c => agent(buildPrompt(c), { label: `build:${c.id}`, phase: 'Build', schema: BUILD_SCHEMA, model: 'opus', effort: 'high' }),
  (built, c) => {
    if (!built) { log(`${c.id}: builder returned nothing - no skeptic`); return { chunk: c.id, built: null, verified: null } }
    log(`${c.id}: ${built.filesMentioned}/${built.filesExpected} files, ${built.findings.length} findings - verifying`)
    return agent(verifyPrompt(c, built), { label: `verify:${c.id}`, phase: 'Verify', schema: VERIFY_SCHEMA, model: 'opus', effort: 'high' })
      .then(v => {
        if (v) log(`${c.id}: verified - ${v.claimsRefuted}/${v.claimsSampled} claims refuted, ${v.pathsBroken} paths broken, +${v.findingsAdded} findings, +${v.filesAddedToBrain} files`)
        else log(`${c.id}: skeptic returned nothing - brain file is UNVERIFIED`)
        return { chunk: c.id, built, verified: v }
      })
  })

const results = chains.filter(Boolean)
const done = results.filter(r => r.built).map(r => r.chunk)
const missing = chunks.map(c => c.id).filter(id => !done.includes(id))
const unverified = results.filter(r => r.built && !r.verified).map(r => r.chunk)
log(`build+verify: ${done.length}/${chunks.length} brain files${missing.length ? ' - MISSING ' + missing.join(',') : ''}${unverified.length ? ' - UNVERIFIED ' + unverified.join(',') : ''}`)

// --- Phase 4+5: four synthesis chains in parallel, each ending in its own review ------
const chain = (name, first, ...rest) => async () => {
  const out = {}
  let prev = await first()
  out[name[0]] = prev
  for (let i = 0; i < rest.length; i++) {
    if (!prev) { log(`${name[i]} returned nothing - skipping ${name[i + 1]}`); break }
    prev = await rest[i](prev, out)
    out[name[i + 1]] = prev
  }
  return out
}
const opus = (label, phase, schema, effort) => ({ label, phase, schema, model: 'opus', effort })

const synth = await parallel([
  chain(['s1', 'v1'],
    () => agent(s1Prompt(missing), opus('S1:expert-skill', 'Synthesise', S1_SCHEMA, 'xhigh')),
    s1 => { log(`S1: skill body ${s1.skillBodyWords} words, ${s1.modulesMapped} modules, ${s1.routesIndexed} routes, ${s1.storesIndexed} stores, gaps ${s1.gaps.length}`); return agent(v1Prompt(s1), opus('V1:skill-qa', 'Review', V1_SCHEMA, 'high')) }),
  chain(['s2', 's3', 'v2'],
    () => agent(s2Prompt(missing), opus('S2:overview-docs', 'Synthesise', S2_SCHEMA, 'high')),
    s2 => { log(`S2: overview ${s2.overviewWords}w, guide ${s2.guideWords}w, broken links ${s2.brokenLinks}`); return agent(s3Prompt(s2), opus('S3:html-brief', 'Synthesise', S3_SCHEMA, 'high')) },
    (s3, out) => { log(`S3: html ${s3.bytes} bytes, external ${s3.externalResources}, red ${s3.redAccentUses}`); return agent(v2Prompt(out.s2, s3), opus('V2:docs-review', 'Review', V2_SCHEMA, 'high')) }),
  chain(['s4', 'v3'],
    () => agent(s4Prompt(missing), opus('S4:rn-faults-report', 'Synthesise', S4_SCHEMA, 'xhigh')),
    s4 => { log(`S4: ${s4.words}w, faults ${s4.faultsTotal} (H${s4.faultsBySeverity.HIGH}/M${s4.faultsBySeverity.MEDIUM}/L${s4.faultsBySeverity.LOW}), option ${s4.recommendedOption}, ${s4.effortRangeWeeks.low}-${s4.effortRangeWeeks.high} weeks`); return agent(v3Prompt(s4), opus('V3:report-skeptic', 'Review', V3_SCHEMA, 'xhigh')) }),
  chain(['s5', 'v4'],
    () => agent(s5Prompt(missing), opus('S5:ui-redesign', 'Synthesise', S5_SCHEMA, 'xhigh')),
    s5 => { log(`S5: ${s5.words}w, ${s5.diagnosisRows} diagnosis rows, ${s5.primitivesSpecified} primitives, ${s5.referencesCited} refs, new colours ${s5.newColourValuesIntroduced}`); return agent(v4Prompt(s5), opus('V4:redesign-critic', 'Review', V4_SCHEMA, 'xhigh')) }),
])

const [skill, docs, report, redesign] = synth.map(x => x || {})
log('all chains returned')

// --- Return counts and paths only; the artefacts stay on disk ------------------------
return {
  brain: {
    built: done, missing, unverified,
    perChunk: results.map(r => ({
      chunk: r.chunk,
      files: r.built ? `${r.built.filesMentioned}/${r.built.filesExpected}` : 'none',
      findings: r.built ? r.built.findings.length : 0,
      refuted: r.verified ? `${r.verified.claimsRefuted}/${r.verified.claimsSampled}` : null,
      pathsBroken: r.verified ? r.verified.pathsBroken : null,
      findingsAdded: r.verified ? r.verified.findingsAdded : null,
      focusUnanswered: r.verified ? r.verified.focusQuestionsUnanswered : null,
      files_: [r.built && r.built.file, r.verified && r.verified.file].filter(Boolean),
    })),
  },
  inventory: inv ? { unassignedFiles: inv.unassignedFiles, useClientFiles: inv.useClientFiles, summaryPath: inv.summaryPath, notes: inv.notes } : null,
  skill: skill.s1 ? { outputs: skill.s1.outputs, bodyWords: skill.s1.skillBodyWords, gaps: skill.s1.gaps, qa: skill.v1 ? { routedAndCorrect: skill.v1.routedAndCorrect, brainWrong: skill.v1.routedButBrainWrong, notRoutable: skill.v1.notRoutable, edits: skill.v1.routingEditsMade, brainDefects: skill.v1.brainDefects, file: skill.v1.file } : null } : null,
  docs: docs.s2 ? { outputs: docs.s2.outputs, html: docs.s3 ? { output: docs.s3.output, bytes: docs.s3.bytes, external: docs.s3.externalResources, red: docs.s3.redAccentUses } : null, review: docs.v2 ? { refuted: `${docs.v2.claimsRefuted}/${docs.v2.claimsSampled}`, divergencesFixed: docs.v2.divergencesFixed, edits: docs.v2.editsMade, file: docs.v2.file } : null } : null,
  report: report.s4 ? { output: report.s4.output, faults: report.s4.faultsBySeverity, option: report.s4.recommendedOption, weeks: report.s4.effortRangeWeeks, skeptic: report.v3 ? { refuted: `${report.v3.rowsRefuted}/${report.v3.rowsSampled}`, stands: report.v3.recommendationStands, flip: report.v3.flipCondition, arithmeticErrors: report.v3.arithmeticErrors, edits: report.v3.editsMade, file: report.v3.file } : null } : null,
  redesign: redesign.s5 ? { outputs: redesign.s5.outputs, newColours: redesign.s5.newColourValuesIntroduced, openDecisions: redesign.s5.openDecisions, critic: redesign.v4 ? { diagnosisRefuted: `${redesign.v4.diagnosisRefuted}/${redesign.v4.diagnosisChecked}`, specsFixed: redesign.v4.specsFixed, contrastFailures: redesign.v4.contrastFailures, edits: redesign.v4.editsMade, file: redesign.v4.file } : null } : null,
}
