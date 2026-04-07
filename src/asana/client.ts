import { ApiClient, TasksApi } from 'asana';
import { config } from '../config/index.js';
import { loadTeam, findAssignee, type TeamMember } from '../config/team.js';
import { PROMPT_VERSION } from '../ai/prompts.js';
import type { ExtractedTask } from '../validator/taskSchema.js';

const client = ApiClient.instance;
client.authentications['token'].accessToken = config.asanaAccessToken;

const tasksApi = new TasksApi();
const team = loadTeam();

export interface AsanaTaskResult {
  gid: string;
  name: string;
  permalink_url: string;
  assignee: TeamMember | null;
}

export async function createAsanaTask(task: ExtractedTask): Promise<AsanaTaskResult> {
  if (!task.is_actionable) {
    throw new Error('Attempted to create a task from a non-actionable email');
  }

  const priorityTag: Record<string, string> = {
    high: '🔴 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  };

  const assignee = findAssignee(task.suggested_role, task.suggested_level, team);

  const body = {
    data: {
      name: task.task_name,
      notes: [
        task.notes,
        '',
        `Priority: ${priorityTag[task.priority]}`,
        `Tags: ${task.suggested_tags.join(', ') || 'none'}`,
      ].join('\n'),
      projects: [config.asanaProjectId],
      ...(task.due_date && { due_on: task.due_date }),
      ...(assignee && { assignee: assignee.email }),
      ...(config.asanaPromptVersionFieldGid && {
        custom_fields: { [config.asanaPromptVersionFieldGid]: PROMPT_VERSION },
      }),
    },
  };

  const response = await tasksApi.createTask(body, {
    opt_fields: ['gid', 'name', 'permalink_url'],
  });

  return { ...(response.data as Omit<AsanaTaskResult, 'assignee'>), assignee };
}
