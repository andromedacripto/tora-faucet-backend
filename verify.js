const express = require("express");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const Web3 = require("web3").default;

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIGURAÇÕES ===
const SECRET_KEY = "6LcKmGUrAAAAANzc99Ttfz7goUJlG7CdXKHY9EdM";
const INFURA_URL = "https://sepolia.infura.io/v3/fa6ca458540b46e58dc33801cb1fcd65";
const PRIVATE_KEY = "0xd379be7cf2b950cf111cedee0a33c448eda46a32b23223d4d18dfc9dac336682";
const TOKEN_ADDRESS = "0x2bd73CCaC4194Fe41481e49935Aa972AA69e4A6E";

const web3 = new Web3(INFURA_URL);
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

const tokenAbi = [
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  }
];

const contract = new web3.eth.Contract(tokenAbi, TOKEN_ADDRESS);

// Objeto para guardar timestamps do último claim por wallet
const lastClaimTimestamps = {};

// Tempo de bloqueio em milissegundos (24h = 86400000ms)
const LOCK_TIME = 24 * 60 * 60 * 1000;

app.post("/verify-captcha", async (req, res) => {
  const captchaToken = req.body.response;  // no front, o token vem em 'response'
  const address = req.body.address.toLowerCase();

  if (!captchaToken || !address) {
    return res.status(400).json({ success: false, message: "Token ou endereço ausente." });
  }

  // Verificar o reCAPTCHA no Google
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${SECRET_KEY}&response=${captchaToken}`
  });

  const data = await response.json();
  console.log("Verificação do reCAPTCHA:", data);
  if (!data.success) {
    return res.status(400).json({ success: false, message: "CAPTCHA inválido." });
  }

  // Verificar bloqueio de 24 horas
  const now = Date.now();
  const lastClaim = lastClaimTimestamps[address] || 0;

  if (now - lastClaim < LOCK_TIME) {
    const remainingMs = LOCK_TIME - (now - lastClaim);
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return res.status(429).json({ 
      success: false, 
      message: `Você já fez o claim nas últimas 24 horas. Tente novamente em ${remainingHours}h ${remainingMinutes}min.` 
    });
  }

  try {
    const amount = web3.utils.toWei("10", "ether"); // 10 TORA
    const tx = await contract.methods.transfer(address, amount).send({
      from: account.address,
      gas: 100000
    });

    console.log("✅ TORA enviado:", tx.transactionHash);
    lastClaimTimestamps[address] = now; // Atualiza timestamp do claim
    res.json({ success: true, txHash: tx.transactionHash });
  } catch (error) {
    console.error("Erro ao transferir TORA:", error);
    res.status(500).json({ success: false, message: "Erro ao enviar tokens" });
  }
});

app.listen(3000, () => {
  console.log("✅ Backend rodando em http://localhost:3000");
});



