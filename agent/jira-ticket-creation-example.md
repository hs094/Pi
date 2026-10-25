# Jira ticket creation example

## Verified successful ticket

Ticket **SOC-283** was created in **AI SOC Agent** with component **Integration**:

- Type: Bug
- Summary: `[Custom HTTP Tools] Comment webhook fails if ServiceNow ticket ID is not yet linked`
- Result: https://simbianai.atlassian.net/browse/SOC-283
- Project key: `SOC`
- Component ID used: `10000` (`Integration`)

The successful create call used one `codemode` invocation. In that session, project/component discovery happened in earlier invocations; the template below shows how to bundle discovery and creation into one call.

## One-call template

Adapt the summary, description, and issue type to the request. This is a template—do not run it unchanged, as it creates a Jira issue.

```js
const parse = (result) => JSON.parse(result.content.find((item) => item.type === 'text').text);

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

const issueType = project.issueTypes.find((item) => item.name === 'Bug');
if (!issueType) throw new Error('Bug issue type is not available');

const metadata = parse(await tools.mcp__jira__getJiraIssueTypeMetaWithFields({
  cloudId: site.id,
  projectIdOrKey: project.key,
  issueTypeId: issueType.id,
  requiredFieldsOnly: false,
}));
const component = metadata.fields
  .find((field) => field.key === 'components')
  ?.allowedValues?.find((item) => item.name === 'Integration');
if (!component) throw new Error('Integration component is not available');

const created = await tools.mcp__jira__createJiraIssue({
  cloudId: site.id,
  projectKey: project.key,
  issueTypeName: issueType.name,
  summary: '<replace with requested summary>',
  description: '<replace with requested description>',
  additional_fields: { components: [{ id: component.id }] },
});
text(created);
```
