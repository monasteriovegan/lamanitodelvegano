export type ScheduledJob = 'reconcile' | 'opportunities' | 'abandoned-carts';

type RuntimeEnvironment = Record<string, string | undefined>;

const cronFlags: Record<ScheduledJob, string> = {
  reconcile: 'LMV_CRON_RECONCILE_ENABLED',
  opportunities: 'LMV_CRON_OPPORTUNITIES_ENABLED',
  'abandoned-carts': 'LMV_CRON_ABANDONED_CARTS_ENABLED',
};

export function scheduledJobEnabled(
  job: ScheduledJob,
  environment: RuntimeEnvironment = process.env,
) {
  return environment[cronFlags[job]] !== 'false';
}
