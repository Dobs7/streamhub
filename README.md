# StreamHub

**Download e uso gratuitos.** Qualquer pessoa pode baixar, instalar e usar este aplicativo sem pagar ao Dobs by Azura. Serviços externos, assinaturas e conteúdos de terceiros mantêm suas próprias condições.

[Baixar para Windows](https://github.com/Dobs7/streamhub/releases/download/v0.6.1/StreamHub-0.6.1-Windows.exe) · [Ver a release e os arquivos](https://github.com/Dobs7/streamhub/releases/tag/v0.6.1)

## Como foi feito
Desenvolvido com Electron, React, TypeScript e Vite. A interface consulta catálogos e serviços externos por uma camada local no processo principal do aplicativo.

Criado por **Dobs by Azura** · Windows x64 · versão 0.6.1.

## Para que serve
Ajuda a descobrir filmes e séries e consultar onde estão disponíveis no Brasil. Reúne busca, avaliações com suas fontes, ofertas de streaming/aluguel/compra, elenco, direção, seleções de estúdios, Oscar e trailers.

## Baixar e usar
Na seção **Releases** deste repositório, baixe `StreamHub-0.6.1-Windows.exe`. É portátil: execute o arquivo, sem instalar. O download está na release indicada acima.

1. Abra o StreamHub e pesquise um filme ou série.
2. Abra o título para consultar sinopse, avaliações e ofertas.
3. Selecione seus serviços favoritos para filtrar a descoberta.
4. Use Explorar para navegar por pessoas, estúdios e Oscar; use Trailer quando disponível.
5. Para experimentar a conexão com TV, ative-a no PC, abra o endereço informado na TV e aprove o código no PC. A TV precisa estar na mesma rede.

Internet é necessária para consultar os serviços externos. Login, assinatura e compra são feitos no serviço escolhido. Disponibilidade, preços e trailers dependem das fontes. O conector TV é experimental; não há comprovação nesta entrega em TV física nem garantia de abrir/reproduzir em apps externos. As seleções editoriais acompanham esta versão.

## Privacidade
Distribuição inicial sem contas, histórico, listas pessoais, cookies ou tokens do desenvolvedor. Preferências e cache passam a ser criados localmente por quem usar o app. Consultas de catálogo e trailers usam serviços externos. O pacote não leva o perfil de desenvolvimento.

## Desenvolvimento
Node.js 22+ e pnpm. Execute `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build` e `pnpm desktop`. Para empacotar: `pnpm package:win`. A versão de Windows é distribuída sem certificado de assinatura de código.

## Créditos
Autoria das contribuições: Dobs by Azura. Electron, Chromium, React e demais dependências mantêm seus respectivos créditos e licenças. Dados e marcas de JustWatch, TMDB, IMDb, Rotten Tomatoes, YouTube, Wikipédia e TVmaze pertencem aos respectivos titulares e fontes. Não há afiliação presumida a esses serviços. Não foi atribuída licença aberta ao código próprio nesta preparação.

