import React, { Component } from 'react';
import './App.css';

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
  // {
  //   key: 'zendesk',
  //   name: 'Zendesk',
  //   authType: 'oauth2'
  // }
];
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

const baseUrl = 'https://staging.cloud-elements.com/elements/api-v2';
const getConfig = {
  method: 'GET',
  headers: {
    'Authorization':'User 5lAvtVd4+36Ykml2f6RdYnjPwZ9VOWgJHqgT6wxy4sQ=, Organization 3506b7f983bbf979cc35537c72c48930',
    'Content-Type': 'application/json'
  }
};

class App extends Component {
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
    this.oauthRedirectSend = this.oauthRedirectSend.bind(this);
    this.selectSkill = this.selectSkill.bind(this);
  }

  selectElement(e) {
    this.setState({
      elementSelected: e,
      configs: [],
    });
  }

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

  updateConfig(e, index) {
    let newConf = this.state.configs;
    newConf[index].value = e.target.value;
    this.setState({
      configs: newConf,
    });
  }

  authenticate() {
    const { elementSelected, configs } = this.state;
    if (elementSelected.authType === 'oauth2'){
      this.oauthRedirectSend();
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

  oauthRedirectSend() {
    console.log('oauth flow')
  }

  selectSkill(s) {
    this.setState({
      skillSelected: s
    });
  }

  render() {
    const {
      elementSelected,
      connected,
      configs,
      token,
    } = this.state;
    return (
      <div className="App">
          <div>Select your ticketing application</div>
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
           <div>
              <div>Select your Alexa Skill to deploy:</div>
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
            </div> 
      </div>
    );
  }
}

export default App;


// To DO - add back connected logic and the below for radio buttons
// <div>{`Your ${elementSelected.name} instance token is: ${token}`}</div>
