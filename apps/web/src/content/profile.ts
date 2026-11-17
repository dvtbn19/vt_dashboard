type L = { en: string; vi: string };

export type Lane = 0 | 1 | 2;

export type CareerItem = {
  id: string;
  lane: Lane;
  start: number; // fractional year
  end: number | null; // null = ongoing
  short: string;
  org: string;
  role: L;
  note: L;
  kind: "work" | "study";
};

export const lanes: L[] = [
  { en: "Business & finance", vi: "Kinh doanh & tài chính" },
  { en: "Analysis & product", vi: "Phân tích & sản phẩm" },
  { en: "Data & AI", vi: "Dữ liệu & AI" },
];

/** William's career as a dataset: one row per role, placed in the lane it belongs to. */
export const career: CareerItem[] = [
  {
    id: "vps",
    lane: 0,
    start: 2019.25,
    end: 2022.38,
    short: "VPS",
    org: "VPS Securities",
    role: { en: "Investment consultant", vi: "Chuyên viên tư vấn đầu tư" },
    note: {
      en: "20 clients, US$5M advised. First time mining transaction data to understand behaviour.",
      vi: "20 khách hàng, 5 triệu USD. Lần đầu khai thác dữ liệu giao dịch để hiểu hành vi.",
    },
    kind: "work",
  },
  {
    id: "hadtech",
    lane: 1,
    start: 2021.75,
    end: 2022.46,
    short: "HADTech",
    org: "HADTech",
    role: { en: "Business analyst", vi: "Business analyst" },
    note: {
      en: "Designed a curriculum database and turned 300 survey responses into a product roadmap.",
      vi: "Thiết kế cơ sở dữ liệu chương trình học, biến 300 phản hồi khảo sát thành lộ trình sản phẩm.",
    },
    kind: "work",
  },
  {
    id: "vinuni",
    lane: 1,
    start: 2022.75,
    end: 2023.88,
    short: "VinUni",
    org: "VinUniversity",
    role: { en: "Project coordinator & BA", vi: "Điều phối dự án & BA" },
    note: {
      en: "Validation rules for a provincial data platform, Salesforce analytics, a benchmarking dataset.",
      vi: "Quy tắc kiểm tra dữ liệu cho nền tảng cấp tỉnh, phân tích Salesforce, bộ dữ liệu benchmark.",
    },
    kind: "work",
  },
  {
    id: "google",
    lane: 2,
    start: 2023.3,
    end: 2023.6,
    short: "Google",
    org: "Google / Coursera",
    role: { en: "Data Analytics certificate", vi: "Chứng chỉ Data Analytics" },
    note: { en: "The decision point: learn the tools properly.", vi: "Điểm quyết định: học bài bản các công cụ." },
    kind: "study",
  },
  {
    id: "uts",
    lane: 2,
    start: 2024.08,
    end: 2026.38,
    short: "UTS",
    org: "University of Technology Sydney",
    role: { en: "Master of Data Science & Innovation", vi: "Thạc sĩ Data Science & Innovation" },
    note: {
      en: "Distinction average, merit award. Multi-agent churn model, 1B-row forecasting pipeline.",
      vi: "Loại Distinction, giải thưởng Merit. Mô hình churn đa agent, pipeline dự báo 1 tỷ dòng.",
    },
    kind: "study",
  },
  {
    id: "coffee",
    lane: 0,
    start: 2025.83,
    end: null,
    short: "Chef's Coffee",
    org: "TripleEC — Chef's Coffee Gordon",
    role: { en: "Operations manager", vi: "Quản lý vận hành" },
    note: {
      en: "Analytics on the shop floor: energy −11%, waste −9%, labour cost −5% of revenue.",
      vi: "Phân tích dữ liệu ngay tại quán: điện gas −11%, lãng phí −9%, chi phí nhân công −5% doanh thu.",
    },
    kind: "work",
  },
  {
    id: "ct",
    lane: 2,
    start: 2026.42,
    end: null,
    short: "C&T",
    org: "C&T Financial Consulting",
    role: { en: "Data operations officer", vi: "Data operations officer" },
    note: {
      en: "Validating financial records against source data, every week.",
      vi: "Kiểm tra dữ liệu tài chính đối chiếu chứng từ gốc hằng tuần.",
    },
    kind: "work",
  },
];

/** Inline segments: plain text or a highlighted number. */
export type Seg = string | { m: string };

export const impact: { en: Seg[]; vi: Seg[] }[] = [
  {
    en: ["At a café in Gordon I mapped every menu item to the equipment it needs and re-sequenced production. Energy costs fell ", { m: "11%" }, ", food waste ", { m: "9%" }, ", and labour cost as a share of revenue ", { m: "5%" }, "."],
    vi: ["Tại một quán café ở Gordon, tôi đối chiếu từng món với thiết bị cần dùng rồi sắp xếp lại quy trình. Chi phí điện gas giảm ", { m: "11%" }, ", lãng phí thực phẩm giảm ", { m: "9%" }, ", chi phí nhân công trên doanh thu giảm ", { m: "5%" }, "."],
  },
  {
    en: ["For my master's capstone, four AI agents scoped, modelled and explained a churn problem on their own, reaching ", { m: "0.966 AUROC" }, ". Another project trained a forecasting model over ", { m: "1B+ rows" }, " in about two minutes."],
    vi: ["Trong đồ án tốt nghiệp thạc sĩ, bốn AI agent tự xác định, mô hình hoá và giải thích bài toán churn, đạt ", { m: "AUROC 0.966" }, ". Một dự án khác train mô hình dự báo trên ", { m: "hơn 1 tỷ dòng" }, " trong khoảng hai phút."],
  },
  {
    en: ["Before that I advised ", { m: "US$5M" }, " of client money and wrote the requirements that engineers built from. I know what the data is for before I touch it."],
    vi: ["Trước đó tôi tư vấn ", { m: "5 triệu USD" }, " tài sản khách hàng và viết yêu cầu cho đội kỹ thuật xây dựng. Tôi hiểu dữ liệu dùng để làm gì trước khi bắt tay vào xử lý."],
  },
];

export const profile = {
  name: "Van Thang (William) Doan",
  short: "William Doan",
  location: { en: "Sydney, NSW · Full working rights", vi: "Sydney, NSW · Quyền làm việc toàn thời gian" } as L,
  role: { en: "Data Analyst · Data Engineer · AI Engineer", vi: "Data Analyst · Data Engineer · AI Engineer" } as L,
  email: "doanvanthangbncd@gmail.com",
  github: "https://github.com/dvtbn19",
  linkedin: "https://www.linkedin.com/in/thangdoanvan/",

  headline: {
    en: ["Business sense,", "engineered into data."],
    vi: ["Tư duy kinh doanh,", "được kỹ thuật hoá bằng dữ liệu."],
  },
  intro: {
    en: "Master of Data Science & Innovation (UTS, Distinction average). Six years on the business side — investment advisory, business analysis, operations — taught me which questions are worth answering. Now I build the pipelines, models and AI agents that answer them.",
    vi: "Thạc sĩ Data Science & Innovation (UTS, loại Distinction). Sáu năm làm phía kinh doanh — tư vấn đầu tư, phân tích nghiệp vụ, vận hành — giúp tôi biết câu hỏi nào đáng để trả lời. Giờ tôi xây pipeline, mô hình và AI agent để trả lời chúng.",
  } as L,

  numbers: [
    { v: "1B+", l: { en: "records in a forecasting pipeline", vi: "bản ghi trong pipeline dự báo" } },
    { v: "0.966", l: { en: "AUROC, multi-agent churn model", vi: "AUROC, mô hình churn đa agent" } },
    { v: "US$5M", l: { en: "client assets advised", vi: "tài sản khách hàng tư vấn" } },
    { v: "−11%", l: { en: "energy cost via order-mix analysis", vi: "chi phí năng lượng nhờ phân tích order" } },
    { v: "−9%", l: { en: "food waste via demand trends", vi: "lãng phí nhờ phân tích nhu cầu" } },
    { v: "300", l: { en: "survey responses → product roadmap", vi: "phản hồi khảo sát → lộ trình sản phẩm" } },
  ],

  pillars: [
    {
      k: "01",
      t: { en: "Analyse", vi: "Phân tích" },
      d: {
        en: "EDA, statistics and dashboards that end in a decision — not a chart dump. Trained on real P&Ls, rosters and client books.",
        vi: "EDA, thống kê và dashboard dẫn tới quyết định — không phải một mớ biểu đồ. Rèn luyện từ P&L, lịch ca và danh mục khách hàng thật.",
      },
    },
    {
      k: "02",
      t: { en: "Engineer", vi: "Kỹ thuật dữ liệu" },
      d: {
        en: "Distributed pipelines on Databricks, SQL, Airflow and cloud. Validation rules, drift checks and auditable data flows.",
        vi: "Pipeline phân tán trên Databricks, SQL, Airflow và cloud. Quy tắc kiểm tra dữ liệu, phát hiện drift và luồng dữ liệu có thể kiểm toán.",
      },
    },
    {
      k: "03",
      t: { en: "Automate with AI", vi: "Tự động hoá bằng AI" },
      d: {
        en: "Multi-agent systems (AutoGen, LangGraph, Claude Code) that scope, model and explain. This site's Lab is run by them.",
        vi: "Hệ thống đa agent (AutoGen, LangGraph, Claude Code) tự xác định bài toán, xây mô hình và giải thích. Phần Lab của trang này do chính chúng vận hành.",
      },
    },
  ],

  projects: [
    {
      title: { en: "Multi-agent AI framework for churn prediction", vi: "Framework AI đa agent dự đoán churn" },
      tag: "Master's capstone",
      stack: ["AutoGen", "GPT-4o-mini", "Python"],
      d: {
        en: "Four specialised agents — Business Analyst, Data Scientist, Coder, Business Translator — autonomously scoped, modelled and explained a churn problem. 99.46% accuracy, 0.9662 AUROC on Netflix subscriber data.",
        vi: "Bốn agent chuyên biệt — Business Analyst, Data Scientist, Coder, Business Translator — tự xác định, mô hình hoá và giải thích bài toán churn. Độ chính xác 99.46%, AUROC 0.9662 trên dữ liệu thuê bao Netflix.",
      },
      metric: "0.9662 AUROC",
    },
    {
      title: { en: "Scalable time-series forecasting on 1B+ records", vi: "Dự báo chuỗi thời gian trên 1 tỷ+ bản ghi" },
      tag: "Data engineering",
      stack: ["Databricks", "PySpark", "SQL"],
      d: {
        en: "Distributed pipelines with batch-based online learning, profiling and temporal validation to catch drift and integrity issues. Full model training in ~2 minutes.",
        vi: "Pipeline phân tán với online learning theo batch, profiling và kiểm định theo thời gian để phát hiện drift và lỗi dữ liệu. Train toàn bộ mô hình trong ~2 phút.",
      },
      metric: "~2 min train",
    },
    {
      title: { en: "Multi-account trade execution orchestration", vi: "Điều phối lệnh giao dịch đa tài khoản" },
      tag: "Automation",
      stack: ["Python", "asyncio", "MQL5"],
      d: {
        en: "Asynchronous, event-driven system that synchronises execution and record-keeping across accounts — replacing error-prone manual entry with an auditable process.",
        vi: "Hệ thống bất đồng bộ, hướng sự kiện, đồng bộ việc khớp lệnh và ghi chép trên nhiều tài khoản — thay thế nhập liệu thủ công dễ sai bằng quy trình có thể kiểm toán.",
      },
      metric: "event-driven",
    },
  ],

  experience: [
    {
      org: "C&T Financial Consulting",
      role: { en: "Data Operations Officer", vi: "Data Operations Officer" },
      when: "Jun 2026 — now",
      where: "Chatswood, NSW",
      pts: [
        {
          en: "Validate transaction records for 20 client accounts a week against source documents in a regulated environment.",
          vi: "Kiểm tra giao dịch của 20 tài khoản khách hàng mỗi tuần đối chiếu chứng từ gốc trong môi trường tài chính có quản lý.",
        },
        {
          en: "Keep record structure and classification consistent across systems for compliance-grade reporting.",
          vi: "Duy trì cấu trúc và phân loại dữ liệu nhất quán giữa các hệ thống, phục vụ báo cáo tuân thủ.",
        },
      ],
    },
    {
      org: "TripleEC — Chef's Coffee Gordon",
      role: { en: "Operations Manager", vi: "Quản lý vận hành" },
      when: "Nov 2025 — now",
      where: "Gordon, NSW",
      pts: [
        {
          en: "Mapped order mix to equipment usage and re-sequenced production: −11% electricity & gas, decommissioned the costliest oven.",
          vi: "Đối chiếu cơ cấu order với thiết bị sử dụng và sắp xếp lại quy trình: giảm 11% điện & gas, ngừng dùng lò tốn kém nhất.",
        },
        {
          en: "Consumption-trend ordering cut food waste 9% with zero stockouts; test-and-learn ranging lifted avg transaction value ~5%.",
          vi: "Đặt hàng theo xu hướng tiêu thụ giảm 9% lãng phí, không thiếu hàng; thử nghiệm danh mục sản phẩm tăng ~5% giá trị đơn trung bình.",
        },
        {
          en: "Demand-based rostering reduced labour cost / revenue by 5%; supported due diligence for a second-venue acquisition.",
          vi: "Xếp ca theo dự báo nhu cầu giảm 5% tỷ lệ chi phí nhân công/doanh thu; hỗ trợ thẩm định mua lại cơ sở thứ hai.",
        },
      ],
    },
    {
      org: "VinUniversity — Agile Innovation Center",
      role: { en: "Project Coordinator & Business Analyst", vi: "Điều phối dự án & Business Analyst" },
      when: "Oct 2022 — Nov 2023",
      where: "Hanoi",
      pts: [
        {
          en: "Specified a provincial Green Growth Index platform — field-level validation rules that improved data quality across 3 provinces; ran UAT to go-live.",
          vi: "Đặc tả nền tảng Chỉ số Tăng trưởng Xanh cấp tỉnh — quy tắc kiểm tra dữ liệu giúp nâng chất lượng dữ liệu ở 3 tỉnh; chạy UAT đến khi bàn giao.",
        },
        {
          en: "Built a curriculum benchmarking dataset of leading universities; coordinated 30 research assistants.",
          vi: "Xây bộ dữ liệu benchmark chương trình đào tạo của các đại học hàng đầu; điều phối 30 trợ lý nghiên cứu.",
        },
        {
          en: "Salesforce admissions analytics: self-serve shortlists and a stage-by-stage funnel tracker.",
          vi: "Phân tích tuyển sinh trên Salesforce: danh sách lọc tự phục vụ và theo dõi phễu từng giai đoạn.",
        },
      ],
    },
    {
      org: "HADTech",
      role: { en: "Business Analyst", vi: "Business Analyst" },
      when: "Oct 2021 — Jun 2022",
      where: "Hanoi",
      pts: [
        {
          en: "Designed the master curriculum database (subjects → lessons → exercises) for an e-learning platform.",
          vi: "Thiết kế cơ sở dữ liệu chương trình học gốc (môn → bài → bài tập) cho nền tảng e-learning.",
        },
        {
          en: "Synthesised 300 survey responses into a prioritised product-gap list adopted in the next release.",
          vi: "Tổng hợp 300 phản hồi khảo sát thành danh sách ưu tiên được áp dụng ở bản phát hành tiếp theo.",
        },
      ],
    },
    {
      org: "VPS Securities",
      role: { en: "Investment Consultant", vi: "Chuyên viên tư vấn đầu tư" },
      when: "Apr 2019 — May 2022",
      where: "Hanoi",
      pts: [
        {
          en: "Advised 20 clients / US$5M AUM (~23% avg. annual return) with a goal-based risk-capacity framework.",
          vi: "Tư vấn 20 khách hàng / 5 triệu USD tài sản (lợi nhuận TB ~23%/năm) với khung quản trị rủi ro theo mục tiêu.",
        },
        {
          en: "Mined client transaction data to segment rules-based vs emotional trading and reduce over-trading.",
          vi: "Khai thác dữ liệu giao dịch để phân nhóm hành vi theo quy tắc và cảm xúc, giảm giao dịch quá mức.",
        },
      ],
    },
  ],

  skills: [
    { g: { en: "Languages & data", vi: "Ngôn ngữ & dữ liệu" }, items: ["Python", "SQL", "MySQL", "PySpark", "MQL5"] },
    { g: { en: "Platforms", vi: "Nền tảng" }, items: ["Databricks", "Snowflake", "Airflow", "AWS", "Azure", "Docker", "SAP", "Salesforce"] },
    { g: { en: "AI frameworks", vi: "AI framework" }, items: ["LangChain / LangGraph", "AutoGen", "Claude Code", "OpenClaw", "AutoResearch"] },
    { g: { en: "Business", vi: "Nghiệp vụ" }, items: ["Requirements & UAT", "Process mapping", "Budgeting", "Stakeholder mgmt", "Risk modelling"] },
  ],

  education: [
    {
      t: "Master of Data Science and Innovation",
      o: "University of Technology Sydney",
      w: "2024 — 2026",
      n: { en: "GPA 6.63/7 · TD School Merit Award", vi: "GPA 6.63/7 · Học bổng/Giải thưởng TD School Merit" },
    },
    { t: "Google Data Analytics Professional Certificate", o: "Coursera", w: "2023", n: { en: "", vi: "" } },
    {
      t: "Bachelor of Business Administration — Entrepreneurship",
      o: "National Economics University, Hanoi",
      w: "2018 — 2022",
      n: { en: "GPA 3.5/4 · Dean's List 2019, 2020", vi: "GPA 3.5/4 · Dean's List 2019, 2020" },
    },
  ],
};
