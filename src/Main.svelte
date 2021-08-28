<script>
  let account = null;
  let current_network = null;
  let valid_network = false;
  let custom_token = false;
  let amount = "";
  let destination = "";
  let memo = "";
  let rp = 0;
  let sending = false;

  let token = "4,EOS,eosio.token";
  let custom = "";

  import { onMount } from 'svelte';
  import detectEthereumProvider from '@metamask/detect-provider'
  import { get } from 'svelte/store'
  import { preferences } from './stores'
  import { X } from 'svelte-hero-icons'
  import Icon from 'svelte-hero-icons/Icon.svelte'
  import { SvelteToast, toast } from '@zerodevx/svelte-toast'
  import { Asset, Name, Action, Serializer, APIClient } from '@greymass/eosio'
  import { ethers } from "ethers";
  import { Circle } from 'svelte-loading-spinners'

  let msg = `This is a helper tool to transfer tokens from Metamask to any EOS account.`;
  let has_provider = false;

  let netmap = {
      "5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191": Number(95), //Kylin testnet
      "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906": Number(59)  //EOS Mainnet
  };

  onMount(handleOnMount);

  function validateNetwork() {
    valid_network = Object.values(netmap).indexOf(Number(current_network)) != -1;
    if (!valid_network) {
      showError('Network not supported. Please select a valid network');
    }
  }

  function showMessage(msg) {
    toast.push(msg, {
      theme: {
      '--toastBackground': '#48BB78',
      '--toastBarBackground': '#2F855A'
      }
    });
  }

  function showError(msg) {
    toast.push(msg, {
      theme: {
        '--toastBackground': '#F56565',
        '--toastBarBackground': '#C53030'
      }
    });
  }

  async function handleSend() {
    if(sending) return;
      sending=true;

    try {
      validateNetwork();
      if(!valid_network) return;
    
      let token_to_send = token;
      if( custom_token ) token_to_send = custom;
      let parts = token_to_send.split(',');
      
      if(parts.length != 3) throw Error('Invalid token');
      if(Number(amount) <= 0) throw Error('Amount must be positive');

      let api = new APIClient({url:'https://api.eosargentina.io'});
      let res = await api.v1.chain.get_table_rows({
        code           : 'etheraccount',
        scope          : 'etheraccount',
        table          : 'account',
        lower_bound    : account.substr(2),
        limit          : 1,
        index_position : "secondary",
        key_type       : "sha256",
        json           : true
      });
      
      if( !(res && res.rows && res.rows.length == 1 && res.rows[0].eth_address == account.substr(2))) {
        throw Error('Account not found for address ' + account);
      }

      let p = Math.pow(10, Number(parts[0]));
      let a = (Math.round(Number(amount) * p) / p).toFixed(Number(parts[0]));
      let r = Asset.fromString(a + " " + parts[1]);

      amount = a.toString();

      let buff = Serializer.encode({object: Name.from(res.rows[0].eos_account)});
      buff.append(Serializer.encode({object: Name.from(destination)}));
      buff.append(Serializer.encode({object: r}));
      buff.append(Serializer.encode({object: memo}));

      let tmp = Serializer.encode({
        object      : [{
          account : parts[2],
          name  : 'transfer',
          authorization : [{
            actor      : res.rows[0].eos_account,
            permission : 'active'
          }],
          data : buff
        }],
        type        : 'action[]',
        customTypes : [Action]
      });

      let actions = tmp.array;

      let provider = new ethers.providers.Web3Provider(window.ethereum);
      let signer = provider.getSigner();
      const abi = [
        "function pushEosTransaction(uint64 rp, bytes actions) returns (boolean)",
        "function getRp() view returns (uint64)"
      ];

      const address = "0xa1050456bf9f78d485445fb43aa2c6978f3aa5d5";
      const etheraccount = new ethers.Contract(address, abi, signer);

      if (rp == 0) {
        rp = await etheraccount.getRp();
      }

      res = await etheraccount.pushEosTransaction(rp, actions);
      showMessage("Sending...");
    } catch(e) {
      showError(e.message);
    }

    sending=false;
  }

  function handleLogin() {
    if(!has_provider) {
      showError('No eth provider');
      return;
    }

    validateNetwork();
    if(!valid_network) return;

    window.ethereum.request({ method: 'eth_requestAccounts' }).then((accounts)=>{
      account = accounts[0];
      preferences.update((r)=>{return {account:accounts[0]}});
    }, ()=>{
      showError('Login rejected');
    });

  }

  function handleAccountsChanged(accounts) {
    if(accounts && accounts.length) {
      account = accounts[0];
      preferences.update((r)=>{return {account:accounts[0]}});
    } else {
      account = null;
      preferences.update((r)=>{return {account:null}});
    }
  }

  function handleChainChanged(chainId) {
    current_network = Number(chainId);
    validateNetwork();
  }

  function noProvider() {
    has_provider = false;
    preferences.update( (r) => {return {};})  
  }

  function handleOnMount() {
    detectEthereumProvider().then((provider)=>{
      if(provider === null) {
        noProvider();
        return;
      }

      has_provider = true;
      account = get(preferences).account;
      window.ethereum.request({ method: 'eth_chainId' }).then((chainId)=>{
        current_network = Number(chainId);
      });

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }, ()=>{
      noProvider();
    });
  }

  function handleKey(e) {
    custom_token = e.key != "Escape";
    if(custom_token == false) {
      token = "4,EOS,eosio.token";
      custom = "";
    }
  }

</script>

<SvelteToast />
<div class="w-full h-full flex items-center justify-center">
<div class="py-12 w-96 flex-col">
  <div class="flex justify-center">
    <img src="metamask-fox.svg" width=50%>
  </div>

  <h2 class="text-2xl font-bold text-center">Transfer to EOS account</h2>
  <p class="text-lg mt-4 text-gray-600 text-center">{msg}</p>
  <div class="mt-8 max-w-md">
    <div class="grid grid-cols-1 gap-6">
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="block">
        <span class="text-gray-700">Token to transfer</span>
        {#if !custom_token }
        <select class="block w-full mt-1" bind:value={token} on:change={(e)=>{custom_token = token == "--other--"}}>
          <option value="4,EOS,eosio.token">EOS</option>
          <option value="4,USDT,tethertether">USDT</option>
          <option value="3,IQ,everipediaiq">IQ</option>
          <option value="4,TPT,eosiotptoken">TPT</option>
          <option value="8,CHEX,chexchexchex">CHEX</option>
          <option value="4,DAPP,dappservices">DAPP</option>
          <option value="8,OGX,core.ogx">OGX</option>
          <option value="6,BOX,token.defi">BOX</option>
          <option value="4,DFS,minedfstoken">DFS</option>
          <option value="4,USN,danchortoken">USN</option>
          <option value="4,DEX,token.newdex">DEX</option>
          <option value="8,PBTC,btc.ptokens">PBTC</option>
          <option value="4,VIG,vig111111111">VIG</option>
          <option value="4,VIGOR,vigortoken11">VIGOR</option>
          <option value="9,PETH,eth.ptoken">PETH</option>
          <option value="--other--">--other--</option>
        </select>
        {:else}
        <div class="flex-row relative">
          <input type="text" class="mt-1 w-full" placeholder="4,EOS,eosio.token" on:keyup={handleKey} bind:value={custom}/>
          <div class="absolute top-4 right-2" on:click={()=>{handleKey({key:"Escape"})}}>
            <Icon src="{X}" size=18 />
          </div>
        </div>
        {/if}
      </label>

      <label class="block">
        <span class="text-gray-700">Destination account</span>
        <input type="text" class="mt-1 block w-full" placeholder="" bind:value={destination}/>
      </label>
      <label class="block">
        <span class="text-gray-700">Amount</span>
        <input type="email" class="mt-1 block w-full" placeholder="" bind:value={amount}/>
      </label>
      <label class="block">
        <span class="text-gray-700">Memo</span>
        <textarea class="mt-1 block w-full" rows="3" bind:value={memo}></textarea>
      </label>
      {#if !!!account }
      <a href="#" on:click={handleLogin} class="bg-blue-500 hover:bg-blue-700 text-white text-center py-2 px-4 rounded">
        Login
      </a>
      {:else}
      <div class="flex relative">
        <a href="#" on:click={handleSend} class:opacity-50={sending} class:cursor-not-allowed={sending} class="w-full block border-2 bg-green-500 hover:bg-green-700 text-white text-center py-2 px-4 rounded">
          Send
        </a>
        {#if sending }
        <div class="absolute right-3 top-3">
        <Circle size="18" color="#ffffff" unit="px" duration="0.5s"/>
        </div>
        {/if}
      </div>
      {/if}
      </div>
  </div>
</div>
</div>
