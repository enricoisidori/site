// A failed search does not end the shot early; the decoded reserve takes over
// at the deadline. A late fetch is aborted and can never replace a newer shot.
export async function chooseBeforeDeadline(job, { deadline, controller,
  now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout }) {
  let timer;
  const expired = new Promise(resolve => {
    timer = schedule(() => { controller.abort(); resolve(null); }, Math.max(0, deadline - now()));
  });
  const prepared = await Promise.race([job.catch(() => null), expired]);
  if (prepared) { cancel(timer); return prepared; }
  await expired;
  cancel(timer);
  return null;
}
