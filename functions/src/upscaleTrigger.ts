import * as functions from 'firebase-functions';

/** No external calls, paid compute or client-controlled URL fetching. */
export const onUpscaleRequestCreated = functions.firestore
  .document('upscale_requests/{requestId}')
  .onCreate(async snap => {
    await snap.ref.update({status: 'failed', error: 'Legacy upscaler retired. Use the FormLab generation API.'});
  });
