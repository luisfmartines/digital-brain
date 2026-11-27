import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUpRight, Copy } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { appIcon, isNative, useDevice } from '../../expo/device'
import { useAuth } from '../../features/auth/useAuth'
import styles from './LegalPage.module.css'

type DocumentType = 'privacy' | 'terms'
type Section = { id: string; title: string; content: ReactNode }

const controller = 'Luis Felipe Dias Matta Martines'
const privacyEmail = 'lfdmmartines2@gmail.com'
const googlePermissions = 'https://myaccount.google.com/connections'
const googlePolicy = 'https://developers.google.com/terms/api-services-user-data-policy'
const anpdRights = 'https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares'

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const device = useDevice()
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={isNative && device ? (event) => {
    event.preventDefault()
    void device.openLink(href)
  } : undefined}>{children}</a>
}

function ContactEmail() {
  const device = useDevice()
  const [status, setStatus] = useState('')
  if (!isNative || !device) return <a href={'mailto:' + privacyEmail}>{privacyEmail}</a>

  return <span className={styles.contact}>
    {privacyEmail}{' '}
    <button type="button" aria-label="Copiar e-mail" onClick={() => {
      void device.copyText(privacyEmail).then(() => setStatus('E-mail copiado.'), () => setStatus('Não foi possível copiar o e-mail.'))
    }}><Copy size={16} aria-hidden="true" /></button>
    <span role="status">{status}</span>
  </span>
}

const privacy: Section[] = [
  { id: 'dados', title: 'Dados que tratamos', content: <>
    <p>O Digital Brain usa seus dados para oferecer uma conta e organizar as informações que você registra em cada módulo.</p>
    <ul>
      <li><strong>Conta e perfil.</strong> E-mail, nome, nome de usuário, foto, descrição e preferências. Se você entrar com o Google, recebemos informações de perfil autorizadas, como nome, e-mail e foto.</li>
      <li><strong>Planejamento pessoal.</strong> Tarefas, eventos, notas, hábitos, consumo de água, treinos, exercícios, fotos e lançamentos financeiros, conforme os recursos que você usa.</li>
      <li><strong>Interações.</strong> Seguidores, perfis que você segue, publicações, curtidas, comentários e as informações de atividade que você compartilha.</li>
      <li><strong>Dados técnicos.</strong> Informações de sessão, registros de funcionamento e erros podem ser tratados para manter o serviço disponível e investigar problemas.</li>
    </ul>
    <p>O app usa armazenamento local para manter a sessão e guardar preferências. A versão web pode armazenar arquivos do aplicativo no navegador para agilizar o carregamento.</p>
  </> },
  { id: 'finalidades', title: 'Por que usamos os dados', content: <>
    <p>Tratamos os dados necessários para autenticar você, salvar e mostrar seus registros e executar os recursos solicitados. Também podemos usá-los para proteger contas, investigar erros e cumprir obrigações legais, conforme a base legal aplicável a cada operação.</p>
    <p>A conexão com o Google Agenda é opcional e exige sua autorização. Alguns registros que você escolhe inserir, como informações de saúde ou hábitos, podem revelar dados sensíveis. Preencha esses campos apenas conforme necessário para seu uso.</p>
  </> },
  { id: 'google-agenda', title: 'Google Agenda', content: <>
    <p>Com sua autorização, acessamos a lista de calendários e os eventos disponíveis para exibi-los no Digital Brain. Isso pode incluir títulos, horários, descrições, locais e lembretes. A integração também permite criar, editar e excluir eventos nos calendários em que o Google permite essas ações.</p>
    <p>Quando há sincronização, o Digital Brain pode enviar eventos e tarefas agendadas à sua conta Google, incluindo título, data, notas e lembretes do item. Guardamos uma credencial de autorização no servidor para manter a conexão. O acesso ao Google Agenda é separado do login com o Google.</p>
    <p>Usamos os dados obtidos da API do Google Agenda para os recursos de calendário e sincronização descritos nesta seção. Os dados importados por essa API ficam fora do fluxo de processamento de mensagens pelo Neural. Você pode revogar a autorização na sua conta Google. <ExternalLink href={googlePermissions}>Gerenciar conexões da Conta Google</ExternalLink>.</p>
    <p>O uso e a transferência de dados recebidos das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado. <ExternalLink href={googlePolicy}>Consultar a política do Google</ExternalLink>.</p>
  </> },
  { id: 'neural', title: 'Neural e inteligência artificial', content: <>
    <p>Quando você envia um pedido ao Neural, o servidor encaminha a mensagem, parte do histórico recente da conversa e o contexto necessário para interpretar o pedido a um serviço de IA. O app usa o Google Gemini e pode recorrer ao Groq quando esse serviço estiver configurado como alternativa.</p>
    <p>Dependendo do pedido, o contexto pode incluir nomes de hábitos e opções de exercícios. Ao pedir que o Neural registre uma ação, ele pode criar ou atualizar dados no módulo correspondente. Revise o resultado e inclua na conversa apenas as informações necessárias ao pedido.</p>
  </> },
  { id: 'compartilhamento', title: 'Com quem os dados são compartilhados', content: <>
    <p>O Supabase fornece autenticação, banco de dados, armazenamento de arquivos e funções de servidor. Provedores de hospedagem, catálogos externos e os serviços descritos acima podem receber as informações necessárias para atender ao recurso que você utiliza. Esses provedores podem tratar dados fora do Brasil, conforme as regras aplicáveis de transferência internacional.</p>
    <p>Outros usuários podem ver informações como seu nome, usuário, foto e conteúdo que você publica. Confira <Link to="/profile">Perfil → Preferências</Link> para controlar a exibição de rotinas e atividade. Alterar essa preferência e gerenciar publicações são controles separados.</p>
  </> },
  { id: 'retencao', title: 'Armazenamento, segurança e exclusão', content: <>
    <p>Os registros ficam associados à sua conta enquanto forem necessários para disponibilizar o serviço. A sessão e os dados da conta usam controles de acesso. Informações podem ser conservadas quando houver obrigação legal ou outra hipótese de conservação prevista na legislação.</p>
    <p>Para iniciar a remoção da conta, dos registros associados e dos arquivos enviados ao app, entre e selecione <Link to="/profile">Perfil → Excluir conta</Link>. Eventos já gravados no Google Agenda podem permanecer na sua conta Google e podem ser gerenciados por lá.</p>
  </> },
  { id: 'direitos', title: 'Seus direitos e contato', content: <>
    <p>O responsável pelo tratamento de dados pessoais no Digital Brain é <strong>{controller}</strong>. Para solicitar informações ou exercer seus direitos, envie um e-mail para <ContactEmail />. Podemos pedir informações para confirmar sua identidade antes de atender à solicitação.</p>
    <p>Nos termos da LGPD, você pode pedir confirmação do tratamento, acesso, correção, informações sobre compartilhamento, portabilidade, bloqueio ou eliminação de dados nas hipóteses aplicáveis. Você também pode revogar consentimento quando ele for a base do tratamento e apresentar uma petição à ANPD. <ExternalLink href={anpdRights}>Conhecer os direitos dos titulares</ExternalLink>.</p>
    <p>Quando esta política mudar, a data da atualização será indicada no início da página.</p>
  </> },
]

const terms: Section[] = [
  { id: 'servico', title: 'Uso do serviço', content: <>
    <p>Estes termos regem o uso do site e do aplicativo Digital Brain, operados por <strong>{controller}</strong>. O Digital Brain oferece ferramentas para organizar tarefas, calendário, hábitos, finanças pessoais e treinos, além de recursos sociais e do assistente Neural.</p>
    <p>Ao criar uma conta ou usar os recursos do serviço, você concorda com estes termos. Saiba como tratamos seus dados na <Link to="/privacidade">Política de Privacidade</Link>.</p>
  </> },
  { id: 'conta', title: 'Sua conta', content: <>
    <p>Use informações corretas no cadastro, proteja sua senha e mantenha o acesso à conta sob seu controle. Se suspeitar que alguém acessou sua conta, redefina a senha e entre em contato pelo canal abaixo.</p>
  </> },
  { id: 'conteudo', title: 'Conduta e conteúdo', content: <>
    <p>Você continua titular dos direitos que possui sobre o conteúdo que envia. Ao armazenar ou publicar um conteúdo, você autoriza o Digital Brain a processá-lo e exibi-lo conforme o recurso usado e as configurações de compartilhamento aplicáveis.</p>
    <p>Use o serviço de forma lícita e respeite a privacidade e os direitos de outras pessoas. Evite publicar conteúdo de terceiros sem autorização. São proibidos assédio, fraude, distribuição de spam e tentativas de obter acesso indevido a contas ou sistemas.</p>
  </> },
  { id: 'integracoes', title: 'Integrações e assistente', content: <>
    <p>Serviços externos, como o Google Agenda, estão sujeitos às permissões, aos termos e à disponibilidade de seus fornecedores. Ao conectar uma agenda, confira a conta escolhida e revise os dados antes de sincronizar ou excluir eventos.</p>
    <p>O Neural pode interpretar um pedido incorretamente ou gerar uma resposta imprecisa. Confira os registros criados e as instruções sugeridas. As ferramentas de finanças, hábitos e treinos servem para organização pessoal. Para decisões financeiras ou de saúde, procure orientação profissional adequada.</p>
  </> },
  { id: 'encerramento', title: 'Disponibilidade e encerramento', content: <>
    <p>Recursos podem mudar ou ficar temporariamente indisponíveis por manutenção, falhas ou mudanças em integrações. O acesso pode ser limitado em caso de abuso, risco à segurança ou obrigação legal, observados os direitos aplicáveis.</p>
    <p>Você pode encerrar sua conta em <Link to="/profile">Perfil → Excluir conta</Link>. Consulte a seção de <Link to="/privacidade#retencao">armazenamento e exclusão</Link> para entender o que acontece com seus dados.</p>
  </> },
  { id: 'atualizacoes', title: 'Atualizações e contato', content: <>
    <p>Podemos atualizar estes termos conforme o serviço evolui. A data no início da página identifica a versão atual. Seus direitos previstos na legislação aplicável continuam garantidos.</p>
    <p>Para dúvidas sobre o serviço e estes termos, escreva para <ContactEmail />.</p>
  </> },
]

export default function LegalPage({ type }: { type: DocumentType }) {
  const { user } = useAuth()
  const { pathname, hash } = useLocation()
  const isPrivacy = type === 'privacy'
  const sections = isPrivacy ? privacy : terms
  const title = isPrivacy ? 'Política de Privacidade' : 'Termos de Uso'
  const description = isPrivacy
    ? 'Como o Digital Brain usa seus dados e quais escolhas você pode fazer.'
    : 'As condições para usar o Digital Brain e seus recursos.'

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  useEffect(() => {
    const previousTitle = document.title
    document.title = title + ' | Digital Brain'
    return () => { document.title = previousTitle }
  }, [title])

  return <div className={styles.page}>
    <meta name="description" content={description} />
    <header className={styles.header}>
      <Link className={styles.brand} to={user ? '/' : '/login'}>
        <img src={appIcon} alt="" width="36" height="36" /> Digital Brain
      </Link>
      <Link className={styles.appLink} to={user ? '/profile' : '/login'}>
        {user ? 'Voltar ao perfil' : 'Acessar o app'} <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </header>
    <nav className={styles.documents} aria-label="Documentos legais">
      <NavLink to="/privacidade">Política de Privacidade</NavLink>
      <NavLink to="/termos-de-uso">Termos de Uso</NavLink>
    </nav>
    <main className={styles.main}>
      <div className={styles.heading}>
        <h1>{title}</h1>
        <p>{description}</p>
        <time dateTime="2026-11-27">Atualizado em 27 de novembro de 2026</time>
      </div>
      <div className={styles.layout}>
        <nav className={styles.contents} aria-labelledby="legal-contents-title">
          <h2 id="legal-contents-title">Nesta página</h2>
          <ul>
            {sections.map(({ id, title }) => <li key={id}>
              <Link to={{ pathname, hash: '#' + id }} aria-current={hash === '#' + id ? 'location' : undefined}>{title}</Link>
            </li>)}
          </ul>
        </nav>
        <article className={styles.article} aria-label={title}>
          {sections.map(({ id, title, content }) => <section key={id} id={id}>
            <h2>{title}</h2>
            {content}
          </section>)}
        </article>
      </div>
    </main>
  </div>
}
