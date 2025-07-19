import autocannon from 'autocannon';

function randomString(len = 8) {
        return Math.random()
                .toString(36)
                .substring(2, 2 + len);
}

function randomValue(depth = 0) {
        const types = ['string', 'number', 'boolean', 'object', 'array'];
        const type = types[Math.floor(Math.random() * types.length)];

        if (depth > 2) return randomString();

        switch (type) {
                case 'string':
                        return randomString();
                case 'number':
                        return Math.floor(Math.random() * 10000);
                case 'boolean':
                        return Math.random() > 0.5;
                case 'object':
                        return {
                                [randomString()]: randomValue(depth + 1),
                                [randomString()]: randomValue(depth + 1)
                        };
                case 'array':
                        return Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () =>
                                randomValue(depth + 1)
                        );
        }
}

function generateDynamicMetadata() {
        const keys = Array.from({ length: Math.floor(Math.random() * 10 + 3) }, () =>
                randomString()
        );
        return keys.reduce((acc, key) => {
                acc[key] = randomValue();
                return acc;
        }, {});
}

const instance = autocannon({
        url: '/api/logs',
        method: 'POST',
        connections: 100,
        duration: 20,
        headers: {
                Authorization: 'Bearer logs_63edcdf947004ab1bcf794de0a31eff9',
                'Content-Type': 'application/json'
        },
        requests: [
                {
                        setupRequest: (req, context) => {
                                const payload = {
                                        level: ['info', 'warn', 'error', 'debug', 'fatal'][
                                                Math.floor(Math.random() * 5)
                                        ],
                                        namespace: `svc-${randomString(4)}`,
                                        message: `Dynamic log ${randomString(10)} at ${new Date().toISOString()}`,
                                        metadata: generateDynamicMetadata()
                                };

                                req.body = JSON.stringify(payload);
                                return req;
                        }
                }
        ]
});

autocannon.track(instance, { renderProgressBar: true });
