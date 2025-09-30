# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

This is the **Proxmox VE adapter** for ioBroker that enables monitoring and control of Proxmox VE virtualization platform. The adapter connects to Proxmox VE servers via REST API to retrieve information about:
- Virtual machines (VMs) and their status, resource usage
- Linux containers (LXC) and their metrics 
- Proxmox cluster nodes and system information
- Storage pools and backup status
- Network interfaces and statistics

The adapter polls the Proxmox VE API at configurable intervals and creates ioBroker states for monitoring VM/container status, CPU, memory, disk usage, and network traffic. It supports authentication via username/password or API tokens.

## Adapter-Specific Context
- **Adapter Name:** proxmox
- **Primary Function:** Proxmox VE virtualization platform monitoring and control
- **Key Dependencies:** axios for HTTP API calls, @iobroker/adapter-core
- **Target API:** Proxmox VE REST API (typically port 8006)
- **Data Types:** VM/container metrics, node statistics, cluster information
- **Authentication:** Username/password or API token authentication
- **Configuration Requirements:** Server host, port, credentials, polling interval

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Check for expected states creation
                        const states = await harness.states.getStatesAsync('your-adapter.0.*');
                        const stateKeys = Object.keys(states);
                        console.log(`Found ${stateKeys.length} states`);
                        
                        if (stateKeys.length === 0) {
                            return reject(new Error('No states were created after adapter initialization'));
                        }
                        
                        resolve();
                        
                    } catch (error) {
                        console.error('Integration test error:', error.message);
                        reject(error);
                    }
                });
            }).timeout(60000); // Allow 60 seconds for full test
        });
    }
});
```

#### For Adapters with External APIs
When testing adapters that connect to external services, use mock data for integration tests:

```javascript
// Mock Proxmox API responses for testing
const mockProxmoxResponse = {
    nodes: [
        {
            node: 'pve-test',
            status: 'online',
            cpu: 0.15,
            mem: 1073741824,
            maxmem: 8589934592,
            uptime: 123456
        }
    ],
    vms: [
        {
            vmid: 100,
            name: 'test-vm',
            status: 'running',
            cpu: 0.10,
            mem: 536870912,
            maxmem: 2147483648
        }
    ]
};

// In your integration test, mock the axios calls
beforeEach(() => {
    // Mock axios requests to return test data
    jest.spyOn(axios, 'get').mockResolvedValue({
        data: { data: mockProxmoxResponse }
    });
});
```

### For Proxmox Adapter Testing
When testing the Proxmox adapter specifically:
- Mock Proxmox API responses with realistic VM/container data
- Test various VM states (running, stopped, paused)
- Validate proper handling of authentication failures
- Test network connectivity error scenarios
- Use example data files with real Proxmox API response structures

## ioBroker Adapter Core Concepts

### Adapter Class Structure
```javascript
class YourAdapter extends utils.Adapter {
  constructor(options) {
    super({
      ...options,
      name: adapterName,
    });
    
    this.on('ready', this.onReady.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }
}
```

### State Management
- Use `setState()` for writing values
- Use `getState()` for reading values
- Define object structures with `setObjectNotExists()`
- Always handle state changes in `onStateChange()` method

### Configuration Access
```javascript
// Access adapter configuration
const host = this.config.host;
const port = this.config.port;
const username = this.config.username;
```

### Logging Best Practices
```javascript
this.log.error('Connection failed');
this.log.warn('Retry attempt failed');
this.log.info('Adapter started successfully');
this.log.debug('Processing data...');
```

### Unload Method Implementation
```javascript
async onUnload(callback) {
  try {
    // Clear intervals and timeouts
    if (this.requestInterval) {
      clearInterval(this.requestInterval);
      this.requestInterval = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Proxmox Adapter Development Patterns

### API Connection Management
```javascript
// Initialize Proxmox API connection with proper error handling
async initializeConnection() {
    try {
        this.proxmox = new ProxmoxAPI({
            host: this.config.host,
            port: this.config.port || 8006,
            username: this.config.username,
            password: this.decrypt(this.config.password),
            realm: this.config.realm || 'pam'
        });
        
        await this.proxmox.authenticate();
        this.setState('info.connection', true, true);
    } catch (error) {
        this.log.error(`Failed to connect to Proxmox: ${error.message}`);
        this.setState('info.connection', false, true);
    }
}
```

### VM/Container Data Processing
```javascript
// Process VM data with proper state creation
async processVMData(vmData) {
    for (const vm of vmData) {
        const vmId = `vms.${vm.vmid}`;
        
        // Create VM object structure
        await this.setObjectNotExistsAsync(vmId, {
            type: 'channel',
            common: {
                name: vm.name || `VM ${vm.vmid}`
            },
            native: {}
        });
        
        // Set VM states with proper data types
        await this.setStateAsync(`${vmId}.status`, vm.status, true);
        await this.setStateAsync(`${vmId}.cpu`, parseFloat(vm.cpu) || 0, true);
        await this.setStateAsync(`${vmId}.memory`, parseInt(vm.mem) || 0, true);
        await this.setStateAsync(`${vmId}.uptime`, parseInt(vm.uptime) || 0, true);
    }
}
```

### Error Handling for API Operations
```javascript
// Robust error handling for Proxmox API calls
async makeProxmoxRequest(endpoint) {
    try {
        const response = await this.proxmox.request(endpoint);
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            this.log.warn('Authentication failed, attempting to reconnect...');
            await this.initializeConnection();
            throw error;
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            this.log.error(`Network error connecting to Proxmox: ${error.message}`);
            this.setState('info.connection', false, true);
            throw error;
        } else {
            this.log.error(`Proxmox API error: ${error.message}`);
            throw error;
        }
    }
}
```

### Configuration Validation
```javascript
// Validate Proxmox connection settings
validateConfig() {
    const errors = [];
    
    if (!this.config.host) {
        errors.push('Proxmox host is required');
    }
    
    if (!this.config.username) {
        errors.push('Username is required');
    }
    
    if (!this.config.password) {
        errors.push('Password is required');
    }
    
    if (this.config.port && (this.config.port < 1 || this.config.port > 65535)) {
        errors.push('Port must be between 1 and 65535');
    }
    
    if (errors.length > 0) {
        this.log.error(`Configuration validation failed: ${errors.join(', ')}`);
        return false;
    }
    
    return true;
}
```