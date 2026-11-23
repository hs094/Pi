# Jira ticket creation example

Use this as the complete Jira-creation playbook. Resolve project, issue type, and component, then create the issue in **one codemode invocation**. Do not spend separate calls searching for tools whose names are shown below.

## Supported project and components

- Project: **AI SOC Agent** (`SOC`)
- Component: **Platform** or **Integration**, according to the user's explicit request.
- Discover the selected component's ID from Jira metadata at creation time; never assume or hardcode an ID.
- The verified example is SOC-283 (Bug, Integration). Platform was also verified in project metadata as an allowed component; look it up dynamically just like Integration.

If the requested component, project, or suitable issue type is unavailable or ambiguous, stop and ask before creating. Use **Task** for requested work/optimization, **Bug** for a defect, and another type only when requested or clearly appropriate.

## Pi MCP workflow notes

- Jira tools are in the `mcp__jira` namespace. Call known tools directly as `tools.mcp__jira__...`.
- Do not call `searchTools()` or inspect `ALL_TOOLS` for this workflow. They wait for every enabled MCP server, not just Jira.
- Make project lookup, issue-type lookup, component metadata lookup, and creation sequentially in one codemode script.
- Keep Jira field metadata responses small: request `maxResults: 4` and stop paging as soon as the Components field is found. Fetching all optional field metadata can produce a large response that gets truncated and cannot be parsed.
- Parse the MCP result's text JSON; check `isError` before using it. If creation returns an error or an unclear result, verify whether the issue exists before retrying, to avoid duplicate tickets.

## One-call template

Fill in the request-specific values before running. Do not run with placeholders.

```js
const parse = (result) => {
  if (result?.isError) {
    const message = result.content?.find((item) => item.type === 'text')?.text ?? 'Jira call failed';
    throw new Error(message);
  }
  if (result?.structuredContent) return result.structuredContent;
  const raw = typeof result === 'string'
    ? result
    : result?.content?.find((item) => item.type === 'text')?.text;
  if (!raw) throw new Error('Jira returned no JSON content');
  return JSON.parse(raw);
};

const componentName = '<Platform or Integration>';
const issueTypeName = '<Task, Bug, or requested type>';
const summary = '<concise requested summary>';
const description = '<scope, context, and acceptance criteria>';

if (!['Platform', 'Integration'].includes(componentName)) {
  throw new Error('Choose the component explicitly requested by the user: Platform or Integration');
}

const sites = parse(await tools.mcp__jira__getAccessibleAtlassianResources({}));
const site = sites.find((item) => item.url.includes('simbianai.atlassian.net'));
if (!site) throw new Error('Simbian Jira site is not accessible');

const projects = parse(await tools.mcp__jira__getVisibleJiraProjects({
  cloudId: site.id,
  searchString: 'AI SOC Agent',
  action: 'create',
  expandIssueTypes: true,
}));
const project = projects.values.find((item) => item.name === 'AI SOC Agent');
if (!project) throw new Error('AI SOC Agent project is not available');

const issueType = project.issueTypes.find((item) => item.name === issueTypeName);
if (!issueType) throw new Error(`${issueTypeName} issue type is not available; ask before creating`);

let component;
let total = Infinity;
for (let startAt = 0; startAt < total; startAt += 4) {
  const metadata = parse(await tools.mcp__jira__getJiraIssueTypeMetaWithFields({
    cloudId: site.id,
    projectIdOrKey: project.key,
    issueTypeId: issueType.id,
    requiredFieldsOnly: false,
    startAt,
    maxResults: 4,
  }));
  component = metadata.fields
    .find((field) => field.key === 'components')
    ?.allowedValues?.find((item) => item.name === componentName);
  if (component) break;
  total = metadata.total;
  if (!metadata.fields.length) break;
}
if (!component) throw new Error(`${componentName} component is unavailable for this issue type`);

const created = parse(await tools.mcp__jira__createJiraIssue({
  cloudId: site.id,
  projectKey: project.key,
  issueTypeName: issueType.name,
  summary,
  description,
  contentFormat: 'markdown',
  additional_fields: { components: [{ id: component.id }] },
}));
if (!created.key) throw new Error('Jira did not return a created issue key');
text({ key: created.key, url: `https://simbianai.atlassian.net/browse/${created.key}` });
```

## Verified successful ticket

- Ticket: **SOC-283**
- Project: **AI SOC Agent** (`SOC`)
- Type: Bug
- Component: Integration (component ID `10000`)
- Summary: `[Custom HTTP Tools] Comment webhook fails if ServiceNow ticket ID is not yet linked`
- URL: https://simbianai.atlassian.net/browse/SOC-283
