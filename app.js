//AO INICIAR UM ARQUIVO JS SEMPRE DECLARE UMA VARIAVEL DE SUA BIBLIOTECA
const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3");
// const bodyparser = require("body-parser") //Até a versão 4 é necessario usar esse codigo

const app = express(); //Armazena as chamadas e propriedades da biblioteca EXPRESS

const PORT = 8000;

//Conexão com o Banco de Dados
const db = new sqlite3.Database("users.db");
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, ativo INTEGER, perfil TEXT(3))"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS Pontuacao_Roupas (id INTEGER PRIMARY KEY AUTOINCREMENT, Descricao TEXT, Pontos INTEGER)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS Turmas (id_turma INTEGER PRIMARY KEY AUTOINCREMENT, sigla TEXT, docente TEXT)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS Arrecadacoes (id_arrecadacao INTEGER PRIMARY KEY AUTOINCREMENT, id_turma INTEGER, id_Roupa, qtd INTEGER, data TEXT)"
  );
});

app.use(
  session({
    secret: "senhaforte",
    resave: true,
    saveUninitialized: true,
  })
);

app.use("/static", express.static(__dirname + "/static"));

//Configuração do Express para processar requisições POST com BODY PARAMETERS
app.use(express.urlencoded({ extended: true })); // Versão Express >= 5.x.x

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  console.log("GET /login");
  res.render("pages/login", { titulo: "Login" });
});

//Rota /login para processamento dos dados do formulário de LOGIN no cliente
app.post("/login", (req, res) => {
  console.log("POST /login");
  console.log(JSON.stringify(req.body));
  const { username, password } = req.body;

  const query = `SELECT * FROM users WHERE username=? AND password=?`;

  db.get(query, [username, password], (err, row) => {
    if (err) throw err; //SE OCORRER O ERRO VÁ PARA O RESTO DO CÓDIGO

    //1. Verificar se o usuário existe
    console.log(JSON.stringify(row));
    if (row) {
      //2. Se o usuário existir e a senha é válida no BD, executar o processo de login
      req.session.username = username;
      req.session.loggedin = true;
      req.session.id_username = row.id;
      if (row.perfil == "ADM") {
        req.session.adm = true;
        res.redirect("/nova-doacao");
      } else {
        req.session.adm = false;
        res.redirect("/tabGeral/1");
      }
    } else {
      //3. Se não, executar processo de negação de login
      res.redirect("/user-senha-invalido");
    }
  });
  // res.render("pages/login")
});

app.get("/user-senha-invalido", (req, res) => {
  res.render("pages/user-senha-invalido", {
    titulo: "Usuario Senha Invalidos",
  });
});

app.get("/tabGeral/:pag", (req, res) => {
  if (req.session.loggedin) {
    console.log("GET /");
    const pag = req.params.pag;
    const query =
      "SELECT Turmas.id_turma, Turmas.sigla, Turmas.docente,Sum(Arrecadacoes.qtd * Pontuacao_Roupas.Pontos) AS totalPontos FROM Turmas INNER JOIN Arrecadacoes ON Turmas.id_turma = Arrecadacoes.id_turma INNER JOIN Pontuacao_Roupas on Arrecadacoes.id_Roupa = Pontuacao_Roupas.id GROUP BY Turmas.id_turma ORDER BY totalPontos DESC";
    const query2 = "SELECT * from Turmas";

    db.all(query, [], (err, row1) => {
      if (err) throw err;

      db.all(query2, [], (err, row2) => {
        if (err) throw err;

        console.log("DADOS: ", JSON.stringify(row1));
        console.log("TURMAS: ", JSON.stringify(row2));
        res.render("pages/index", {
          titulo: "Arrecadações",
          dados: row1,
          turmas: row2,
          req: req,
          pag: pag,
        });
      });
    });
  } else {
    tituloError = "Não Autorizado";
    res.redirect("/nao-autorizado");
  }
});

app.get("/arrecadacoes/:pag", (req, res) => {
  if (req.session.loggedin) {
    console.log("GET /arrecadacoes");
    const pag = req.params.pag;
    const orderBy = req.query.orderBy;
    console.log(orderBy);
    let query =
      "SELECT id_arrecadacao, Turmas.sigla, Pontuacao_Roupas.Descricao, Pontuacao_Roupas.Pontos, qtd, data FROM Arrecadacoes INNER JOIN Turmas ON Arrecadacoes.id_turma = Turmas.id_turma INNER JOIN Pontuacao_Roupas ON Arrecadacoes.id_roupa = Pontuacao_Roupas.id ORDER BY ";
    if (orderBy == "data"){
      query += " Arrecadacoes.data DESC";
    } else if (orderBy == "sala"){
      query += " Arrecadacoes.id_turma";
    }
      db.all(query, [], (err, row) => {
      if (err) throw err;
      res.render("pages/arrecadacoes", {
        titulo: "Arrecadações",
        dados: row,
        req: req,
        pag: pag,
        orderBy: orderBy,
      });
    });
  } else {
    tituloError = "Não Autorizado";
    res.redirect("/nao-autorizado");
  }
});

app.get("/nova-doacao", (req, res) => {
  if (req.session.adm) {
    console.log("GET /nova-doacao");
    const query = "SELECT * FROM Turmas";
    const query2 = "SELECT * FROM Pontuacao_Roupas";

    // Primeiro obtemos os dados de ambas as tabelas
    db.all(query, [], (err, turmas) => {
      if (err) throw err;

      db.all(query2, [], (err, pontuacoes) => {
        if (err) throw err;

        // Só renderizamos a página quando temos todos os dados
        res.render("pages/nova-doacao", {
          titulo: "Nova Doação",
          req: req,
          turmas: turmas,
          pontuacoes: pontuacoes,
        });
      });
    });
  } else {
    tituloError = "Não Permitido";
    res.redirect("/nao-permitido");
  }
});

app.post("/nova-doacao", (req, res) => {
  console.log("POST /nova-doacao");
  // Pegar dados da postagem: User ID, Titulo, Conteudo, Data da Postagem
  //req.session.username, req.session.id
  if (req.session.adm) {
    const { id_turma, id_roupa, qtd } = req.body;
    const query = `INSERT INTO Arrecadacoes (id_turma, id_roupa, qtd, data) VALUES (?, ? , ?, ?)`;
    const data = new Date();
    const data_atual = data.toLocaleDateString();
    console.log(JSON.stringify(req.body));
    console.log(JSON.stringify(data_atual));

    db.get(query, [id_turma, id_roupa, qtd, data_atual], (err, row) => {
      if (err) throw err; //SE OCORRER O ERRO VÁ PARA O RESTO DO CÓDIGO
      //1. Verificar se o usuário existe
      console.log(JSON.stringify(row));
      res.redirect("/nova-doacao");
    });
  } else {
    tituloError = "Não Permitido";
    res.redirect("/nao-permitido");
  }
});

app.get("/dadosDaTurma/:id", (req, res) => {
  console.log("GET /dadosDaTurma");

  if (req.session.loggedin) {
    const TurmaId = req.params.id;
    const query1 =
      "SELECT Turmas.id_turma, Turmas.sigla, Turmas.docente, Pontuacao_Roupas.Descricao, Arrecadacoes.qtd, (Arrecadacoes.qtd * Pontuacao_Roupas.Pontos) AS Pontos FROM Turmas INNER JOIN Arrecadacoes ON Turmas.id_turma = Arrecadacoes.id_turma INNER JOIN Pontuacao_Roupas on Arrecadacoes.id_Roupa = Pontuacao_Roupas.id Where Turmas.id_turma = ?";
    const query2 = "SELECT * FROM Pontuacao_Roupas";

    db.all(query1, [TurmaId], (err, row) => {
      if (err) throw err;
      db.all(query2, [], (err, roupas) => {
        if (err) throw err;

        if (row == "") {
          res.status(404);
          res.render("pages/fail", {
            titulo: "ERRO 404",
            req: req,
            msg: "404",
          });
        } else {
          console.log("Roupas : ", JSON.stringify(roupas));
          console.log("Dados: ", JSON.stringify(row));
          res.render("pages/dadosDaTurma", {
            titulo: "Dados da Turma",
            dados: row,
            roupas: roupas,
            req: req,
          });
        }
      });
    });
  } else {
    tituloError = "Não Autorizado";
    res.redirect("/nao-autorizado");
  }
});

app.get("/nao-autorizado", (req, res) => {
  console.log("GET /nao-autorizado");
  res.render("pages/nao-autorizado", { titulo: "Não Autorizado" });
});

app.get("/nao-permitido", (req, res) => {
  console.log("GET /nao-permitido");
  res.render("pages/nao-permitido", { titulo: "Não Permitido" });
});

app.get("/logout", (req, res) => {
  console.log("GET /logout");
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.use("/{*erro}", (req, res) => {
  // Envia uma resposta de erro 404
  res
    .status(404)
    .render("pages/fail", { titulo: "ERRO 404", req: req, msg: "404" });
});

app.listen(PORT, () => {
  console.log(`Servidor sendo excexutado na porta ${PORT}`);
  console.log(__dirname + "\\static");
});
