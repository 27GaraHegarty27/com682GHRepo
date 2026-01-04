const { app } = require('@azure/functions');

app.storageQueue('QueueTriggerUpload', {
    queueName: 'upload-jobs',
    connection: 'storcom682_STORAGE',
    handler: (queueItem, context) => {
        context.log('Storage queue function processed work item:', queueItem);
        context.log('DEPLOY TEST - queue item: 2', queueItem);
    }
});
