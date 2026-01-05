'use strict';

const { app } = require('@azure/functions');

// Optional Application Insights (won't crash if not installed / not configured)
let appInsights = null;
let aiClient = null;

function initAppInsightsOnce() {
  if (aiClient) return aiClient;

  try {
    // If you have the package installed, this will work:
    // npm i applicationinsights
    appInsights = require('applicationinsights');

    // If the Function App has Application Insights enabled, one of these is usually present:
    // - APPINSIGHTS_CONNECTIONSTRING (recommended)
    // - APPINSIGHTS_INSTRUMENTATIONKEY (older)
    const hasConn =
      !!process.env.APPINSIGHTS_CONNECTIONSTRING ||
      !!process.env.APPINSIGHTS_INSTRUMENTATIONKEY;

    if (!hasConn) {
      // No App Insights config -> run fine, just no custom telemetry
      return null;
    }

    // Safe to call multiple times; SDK protects against double-start
    appInsights
      .setup()
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setSendLiveMetrics(false)
      .start();

    aiClient = appInsights.defaultClient;
    return aiClient;
  } catch (e) {
    // SDK not installed -> run fine, just no custom telemetry
    return null;
  }
}

function safeJsonParse(value) {
  if (value == null) return { raw: value };
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return { raw: value };

  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

app.storageQueue('QueueTriggerUpload', {
  queueName: 'upload-jobs',
  connection: 'storcom682_STORAGE',
  handler: async (queueItem, context) => {
    const client = initAppInsightsOnce();

    // The portal "Add message" can base64 encode; Functions runtime usually gives you decoded content,
    // but queueItem can still arrive as string/object. Normalize it.
    const msg = safeJsonParse(queueItem);

    // Your Logic App message shape looks like:
    // { container: "media", path: "...", name: "...", size: "..." }
    // But keep it flexible.
    const container = msg.container ?? msg.blobContainer ?? 'unknown';
    const path = msg.path ?? msg.blobPath ?? msg.blobUrl ?? 'unknown';
    const name = msg.name ?? msg.blobName ?? 'unknown';
    const sizeRaw = msg.size ?? msg.blobSize ?? null;
    const sizeBytes =
      typeof sizeRaw === 'number'
        ? sizeRaw
        : typeof sizeRaw === 'string'
          ? Number(sizeRaw)
          : null;

    // Correlation / identifiers (use whatever exists)
    const videoId = msg.video_id ?? msg.videoId ?? msg.id ?? '';
    const invocationId = context.invocationId || '';

    // Normal Azure Function logs (visible in Logs + App Insights automatically if connected)
    context.log('QueueTriggerUpload received:', msg);

    // Custom Application Insights telemetry (used for Azure Dashboard charts)
    if (client) {
      // Helpful dimensions for filtering in App Insights
      const props = {
        functionName: 'QueueTriggerUpload',
        invocationId,
        videoId: String(videoId || ''),
        container: String(container),
        blobName: String(name),
        blobPath: String(path),
      };

      // 1) Track an event every time a message is processed
      client.trackEvent({
        name: 'UploadJobProcessed',
        properties: props,
      });

      // 2) Track a custom metric (shows nicely in dashboards)
      if (Number.isFinite(sizeBytes)) {
        client.trackMetric({
          name: 'UploadBlobSizeBytes',
          value: sizeBytes,
          properties: props,
        });
      }

      // 3) Track how many messages processed (counter-style metric)
      client.trackMetric({
        name: 'UploadJobsCount',
        value: 1,
        properties: props,
      });

      // Flush quickly so you see results in the portal sooner (especially on low traffic)
      // (Non-blocking safety: give it a short await)
      await new Promise((resolve) => {
        client.flush({ isAppCrashing: false, callback: resolve });
      });
    } else {
      context.log(
        "App Insights not configured (no APPINSIGHTS_CONNECTIONSTRING / SDK missing) -> telemetry skipped."
      );
    }

    // TODO: your “advanced processing” would go here later.
    // For now, this proves CI/CD + queue trigger + App Insights telemetry are working.
  },
});