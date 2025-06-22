const express = require("express");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const Web3 = require("web3").default;

const app = express();
app.use(cors({
  origin: "https://faucet-tora.netlify.app" // libera só seu frontend
}));
app.use(express.json());

// === CONFIGURAÇÕES ===
const SECRET_KEY = "6LcKmGUrAAAAANzc99Ttfz7goUJlG7CdXKHY9EdM"; // sua secret do reCAPTCHA
const INFURA_URL = "https://sepolia.infura.io/v3/fa6ca458540b46e58dc33801cb1fcd65";
const PRIVATE_KEY = "0xd379be7cf2b950cf111cedee0a33c448eda46a32b23223d4d18dfc9dac336682";
const TOKEN_ADDRESS = "0x2bd73CCaC4194Fe41481e49935Aa972AA69e4A6E";

const web3 = new Web3(INFURA_URL);
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

// ABI do token (somente função transfer)
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

// Guarda timestamps dos últimos claims por wallet (em memória)
const lastClaimTimestamps = {};

app.post("/verify-captcha", async (req, res) => {
  const captchaToken = req.body.response;
  const address = req.body.address?.toLowerCase();

  if (!captchaToken || !address) {
    return res.status(400).json({ success: false, message: "Token ou endereço ausente." });
  }

  // Verifica o reCAPTCHA com o Google
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${SECRET_KEY}&response=${captchaToken}`
  });

  const data = await response.json();
  if (!data.success) {
    return res.status(400).json({ success: false, message: "CAPTCHA inválido." });
  }

  // Verifica o bloqueio de 24 horas
  const now = Date.now();
  const lastClaim = lastClaimTimestamps[address] || 0;
  const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

  if (hoursSinceLastClaim < 24) {
    const hoursLeft = (24 - hoursSinceLastClaim).toFixed(1);
    return res.status(429).json({ success: false, message: `Você já fez claim nas últimas 24h. Tente novamente em ${hoursLeft}h.` });
  }

  try {
    const amount = web3.utils.toWei("10", "ether"); // 10 TORA
    const tx = await contract.methods.transfer(address, amount).send({
      from: account.address,
      gas: 100000
    });

    lastClaimTimestamps[address] = now; // atualiza timestamp do último claim

    console.log(`✅ TORA enviado para ${address}: ${tx.transactionHash}`);
    res.json({ success: true, txHash: tx.transactionHash });
  } catch (error) {
    console.error("Erro ao transferir TORA:", error);
    res.status(500).json({ success: false, message: "Erro ao enviar tokens" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend rodando em http://localhost:${PORT}`);
});




