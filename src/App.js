import React, { Component } from 'react';
import './App.css';
import queryString from 'query-string';

/*
    ******************************************************************************
    Simply add a new Element object into the list below to deploy a new connector!
    ******************************************************************************
*/
// Element Configuration
const elements = [
  {
    key: 'servicenow',
    name: 'ServiceNow',
    authType: 'basic'
  },
  {
    key: 'jira',
    name: 'Jira',
    authType: 'basic'
  },
  {
    key: 'zendesk',
    name: 'Zendesk',
    authType: 'oauth2'
  },
  {
    key: 'autotaskhelpdesk',
    name: 'Autotask',
    authType: 'basic'
  }
];

// Skill Configuration
const skills = [
  {
    key: 'create_ticket',
    name: 'Create ticket',
    description: 'Ask Alexa to create an IT ticket from within your meeting room'
  },
  {
    key: 'test',
    name: 'Test skill',
    description: 'Test skill description'
  }
];


// CE Staging API Base URL
const baseUrl = 'https://staging.cloud-elements.com/elements/api-v2';

// CE GET API Configuration, using tokens for A4B CE Staging Environment
const getConfig = {
  method: 'GET',
  headers: {
    'Authorization':'User 5lAvtVd4+36Ykml2f6RdYnjPwZ9VOWgJHqgT6wxy4sQ=, Organization 3506b7f983bbf979cc35537c72c48930',
    'Content-Type': 'application/json'
  }
};

// Registered URL for App
const callbackUrl = 'https://29870603.ngrok.io/';


/**
 * Main A4B + CE Form Component
 */
class App extends Component {
  /**
   * Component Constructor
   * @param  {object} props
   * @return {void}
   */
  constructor(props) {
    super(props);
    this.state = {
      elementSelected: null,
      connected: false,
      configs: [],
      token: null,
      skillSelected: null,
    };
    this.selectElement = this.selectElement.bind(this);
    this.fetchConfigs = this.fetchConfigs.bind(this);
    this.updateConfig = this.updateConfig.bind(this);
    this.authenticate = this.authenticate.bind(this);
    this.selectSkill = this.selectSkill.bind(this);
    this.submit = this.submit.bind(this);
    this.createInstanceFromOAuth = this.createInstanceFromOAuth.bind(this);
  }

  componentDidMount() {
    //const queryParams = {};
    const queryParams = queryString.parse(window.location.search);
    if (queryParams.authState) {
      console.log(queryParams.authState)
    }
    // If an OAuth code is detected with proper parameters, use it to create an instance
    const state = queryParams.state;
    const code = queryParams.code;
    if (code && state) {
      this.createInstanceFromOAuth(queryParams);
    }
  }

  /**
   * Set the state of the selected Element
   * @param  {object} e element information
   * @return {void}
   */
  selectElement(e) {
    this.setState({
      elementSelected: e,
      configs: [],
    });
  }

  /**
   * For the selected Element, fetch the authentication configuration from CE
   * and set the state with the config parameters to build the auth form
   * @return {void}
   */
  fetchConfigs() {
    const { elementSelected } = this.state;
    let configs = [];
    const request = async () => {
      const response = await fetch(`${baseUrl}/elements/${elementSelected.key}/authentication-types/${elementSelected.authType}/configurations`, getConfig);
      const json = await response.json();
      configs = json;
      configs.unshift({
        name: 'Name this connection',
        required: true,
        key: 'instanceName',
        type: 'TEXTFIELD_32',
      });
      await this.setState({
        configs
      });
    };
    request();
  }

  /**
   * Update the auth config as user enters inputs
   * to capture things like password, username, API key, etc.
   * @param  {object} e     event object from HTML input
   * @param  {int}    index of config item
   * @return {void}
   */
  updateConfig(e, index) {
    let newConf = this.state.configs;
    newConf[index].value = e.target.value;
    this.setState({
      configs: newConf,
    });
  }

  /**
   * Conduct the authentication flow to CE
   * If oauth - fetch the oauth url, send user out, then on return post instance (handled in componentDidMount)
   * If not oauth - then post the instance
   * @return {void}
   */
  authenticate() {
    const { elementSelected, configs } = this.state;
    if (elementSelected.authType === 'oauth2') {
      let queryParams = '';
      const apiKey = configs.filter(conf => conf.key === 'oauth.api.key');
      const apiSecret = configs.filter(conf => conf.key === 'oauth.api.secret');
      //const callbackUrl = configs.filter(conf => conf.key === 'oauth.callback.url');
      if (apiKey.length > 0 && apiSecret.length > 0) {
        const state = window.btoa(JSON.stringify({
          elementKey: elementSelected.key,
          configs,
        }));
        queryParams = `apiKey=${apiKey[0].value}&apiSecret=${apiSecret[0].value}&callbackUrl=${callbackUrl}&state=${state}`;
        if (elementSelected.key === 'zendesk') {
          const siteAddress = configs.filter(conf => conf.key === 'zendesk.subdomain');
          queryParams = `apiKey=${apiKey[0].value}&apiSecret=${apiSecret[0].value}&callbackUrl=${callbackUrl}&siteAddress=${siteAddress[0].value}&state=${state}`;
        }
      };
      const request = async () => {
        const response = await fetch(`${baseUrl}/elements/${elementSelected.key}/oauth/url?${queryParams}`, getConfig);
        const json = await response.json();
        // Redirect user to URL generated by Cloud Elements
        window.location = await json.oauthUrl;
      }
      request();
    } else {
      let hasName = configs.filter(conf => conf.key === 'instanceName');
      let postInstanceBody = {
          "element": {
            "key": elementSelected.key
          },
          "tags": [
            "a4b_ce_demo"
          ],
          name: hasName && hasName.length > 0 ? hasName[0].value : (new Date()).getTime(),
      };
      postInstanceBody.configuration = {};
      configs.forEach(conf => {
          if (conf.key !== 'instanceName') {
              postInstanceBody.configuration[conf.key] = conf.value;
          }
      });
      const config = {
        method: 'POST',
        headers: getConfig.headers,
        body: JSON.stringify(postInstanceBody)
      }
      const request = async () => {
        const response = await fetch(`${baseUrl}/elements/${elementSelected.key}/instances`, config);
        const json = await response.json();
        if (await json.token) {
          await this.setState({
            connected: true,
            token: json.token
          });
        }
      }
      request();
    }
  }

  createInstanceFromOAuth(params) {
    const state = JSON.parse(window.atob(params.state));
    console.log('creating', state)
    const elementKey = state.elementKey;
    const configs = state.configs;
    const code = params && params.code ? params.code : {};
    const name = configs.filter(c => c.key === 'instanceName');
    const apiKey = configs.filter(c => c.key === 'oauth.api.key');
    const apiSecret = configs.filter(c => c.key === 'oauth.api.secret');
    const elementSelected = elements.filter(e => e.key === elementKey);
    let postInstanceBody = {
      "element": {
        "key": elementKey
      },
      "tags": [
        "a4b_ce_demo"
      ],
      providerData: {
        code
      },
      name: name[0] && name[0].value ? name[0].value : (new Date()).getTime(),
      configuration: {
        "authentication.type": "oauth2",
        "oauth.callback.url": callbackUrl,
        "oauth.api.key": apiKey[0] && apiKey[0].value ? apiKey[0].value : '',
        "oauth.api.secret": apiSecret[0] && apiSecret[0].value ? apiSecret[0].value : ''
      }
    }
    const config = {
      method: 'POST',
      headers: getConfig.headers,
      body: JSON.stringify(postInstanceBody)
    }
    const request = async () => {
      const response = await fetch(`${baseUrl}/elements/${elementKey}/instances`, config);
      const json = await response.json();
      if (await json.token) {
        await this.setState({
          connected: true,
          token: json.token,
          elementSelected: elementSelected.length > 0 ? elementSelected[0] : null,
          configs,
        });
      }
    }
    request();
  }

  /**
   * Set the state with the selected Amazon Skill
   * @param  {object} s selected skill object
   * @return {void}
   */
  selectSkill(s) {
    this.setState({
      skillSelected: s
    });
  }

  /**
   * Submit the full form, which will kick off logic
   * to deploy the Alexa Skill with the generated instance token
   * @return {void}
   */
  submit() {
    const { token, skillSelected } = this.state;
    console.log('submit logic here');
    console.log('token: ', token);
    // const request = async () => {
    //   const config = {
    //     method: 'POST',
    //     headers: getConfig.headers,
    //     body: JSON.stringify(postInstanceBody)
    //   }
    //   const response = await fetch('https://a4b-ce.ngrok.io/provider', config);
    //   const json = await response.json();
    //   if (await json.token) {
    //     await this.setState({
    //       connected: true,
    //       token: json.token,
    //       elementSelected: elementSelected.length > 0 ? elementSelected[0] : null,
    //       configs,
    //     });
    //   }
    // }
    // request();
    console.log('selected skill: ', skillSelected.name);
  }

  /**
   * Render the A4B + CE form component
   * @return {object} React Component
   */
  render() {
    const {
      elementSelected,
      connected,
      configs,
      token,
      skillSelected
    } = this.state;
    return (
      <div className="App">
          <div>Select your ticketing application:</div>
          {
            elements.map(k => <button
              key={k.key}
              disabled={connected}
              style={{
                cursor: 'pointer',
                padding: 5,
                margin: 20,
                width: 100,
                outline: elementSelected && elementSelected.key === k.key ? '1px solid red' : null
              }}
              onClick={() => this.selectElement(k)}>{k.name}</button>)
          }
          { elementSelected && configs.length === 0 ? this.fetchConfigs() : null }
          {
            elementSelected && configs.length && !connected > 0 ?
              <div>
                {`Authenticate to ${elementSelected.name}`}
                {
                  configs.map((conf,i) => <div style={{ padding: '10px 24px', marginTop: 5 }} key={conf.key}>
                      <div style={{marginBottom: 5}}>{conf.name}{conf.required ? ' *' : null}</div>
                      <input
                        style={{ width: '40%', padding: 5 }}
                        type={(conf.type.toLowerCase() === 'password' || conf.name.toLowerCase().includes("key")) ? 'password' : 'text'}
                        value={conf.value || ''}
                        autoFocus={ i === 0 }
                        onChange={e => this.updateConfig(e, i)}
                      />
                    </div>)
                }
                <button style={{
                    cursor: 'pointer',
                    padding: 5,
                    margin: 20,
                    width: 100
                  }}
                  onClick={() => this.authenticate()}>Connect</button>
              </div> : null
          }
          {
            connected && elementSelected.name ?
             <div>
                <div>{`Your ${elementSelected.name} instance token is: ${token}`}</div>
                <div style={{ marginTop: 10 }}>Select your Alexa Skill to deploy:</div>
                <div>
                  {
                    skills.map(s => <div style={{ padding: '10px 24px' }} key={s.key}>
                      <input
                        type={'radio'}
                        name={'test'}
                        onChange={() => this.selectSkill(s)}
                      />{s.name}<div style={{ fontStyle: 'italic', fontSize: '10px' }}>{` ${s.description}`}</div>
                    </div>)
                  }
                </div>
              <button
                disabled={!skillSelected}
                onClick={() => this.submit()}
                style={{
                  cursor: !skillSelected ? 'normal' : 'pointer',
                  padding: 5,
                  margin: '20px 0px',
                  width: 100
                }}>Submit</button>
              </div> : null
          }
      </div>
    );
  }
}

export default App;