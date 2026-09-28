# Agent Rise save protocol — review draft

This is the readable version of the save protocol implemented in `pilot.js`.

```javascript
function revisionValue(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return 0;
}

async function persistWorkspace() {
    if (!pilot.loaded) {
        pilot.dirty = true;
        notify('Not saved. Connect an account first or export a backup.', true);
        return false;
    }
    trackChanges();
    pilot.dirty = true;
    renderActivityStrip();
    if (pilot.demo) {
        notify('Preview only • changes are in memory. Export a backup to keep them.');
        return true;
    }

    if (pilot.saving) {
        pilot.saveAgain = true;
        return false;
    }

    pilot.saving = true;
    let ok = false;
    const MAX_ATTEMPTS = 3;

    try {
        do {
            pilot.saveAgain = false;
            let attempt = 0;
            let succeeded = false;

            while (attempt < MAX_ATTEMPTS && !succeeded) {
                attempt++;
                const data = snapshot();
                const expectedRevision = revisionValue(pilot.revision);

                if (attempt === 1) notify('Saving…');

                const result = await pilot.db.rpc('save_agent_workspace', {
                    payload: data,
                    expected_revision: expectedRevision
                });

                if (result.error) {
                    const msg = String(result.error.message || '');
                    const isStale =
                        /Account changed/i.test(msg) ||
                        /expected_revision/i.test(msg) ||
                        /revision/i.test(msg);

                    if (isStale && attempt < MAX_ATTEMPTS) {
                        const fresh = await pilot.db.rpc('load_agent_workspace');
                        if (!fresh.error && fresh.data && fresh.data.revision != null) {
                            pilot.revision = revisionValue(fresh.data.revision);
                            notify('Syncing latest changes…');
                            continue;
                        }
                    }
                    throw result.error;
                }

                pilot.revision = revisionValue(result.data);
                succeeded = true;
                ok = true;
            }

            if (!succeeded) {
                throw new Error('Save failed after ' + MAX_ATTEMPTS + ' attempts.');
            }
        } while (pilot.saveAgain);

        pilot.dirty = false;
        pilot.lastSaved = new Date();
        notify('Last saved ' + pilot.lastSaved.toLocaleTimeString());
    } catch (e) {
        if (!ok) pilot.dirty = true;
        notify('Not saved: ' + (e.message || e) + ' • Retry or export a backup before leaving.', true);
        reportError('Supabase save failed', e);
    } finally {
        pilot.saving = false;
    }
    return ok;
}
```

## Revision retry behavior

On a stale revision, Agent Rise loads the current server revision and retries the freshly generated in-memory snapshot. The save makes no more than three attempts.

## Required database functions

This protocol requires both RPC functions installed by `supabase/install.sql`:

- `public.load_agent_workspace()`
- `public.save_agent_workspace(payload jsonb, expected_revision bigint)`
