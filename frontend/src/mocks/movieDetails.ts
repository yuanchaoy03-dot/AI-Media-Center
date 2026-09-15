import type { MovieDetailMetadata } from '../types/movieDetail'

// 摘自 HTML 原型；媒体资源与公共影片元数据分开保存，非真实探测结果。
export const mockMovieDetails: Record<string, MovieDetailMetadata> = {
  "movie-dune": {
    "originalTitle": "Dune",
    "overview": "天赋异禀的少年保罗·厄崔迪随家族前往宇宙中最危险的星球厄拉科斯。围绕珍贵香料的争夺迅速演变为战争，他必须直面自己的命运，并在恐惧与责任之间作出选择。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Denis Villeneuve",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-denis-villeneuve.jpg"
      },
      {
        "name": "Timothée Chalamet",
        "role": "Paul Atreides",
        "portrait": "/mock/detail/tmdb-person-timothee-chalamet.jpg"
      },
      {
        "name": "Rebecca Ferguson",
        "role": "Lady Jessica",
        "portrait": "/mock/detail/tmdb-person-rebecca-ferguson.jpg"
      },
      {
        "name": "Oscar Isaac",
        "role": "Duke Leto Atreides",
        "portrait": "/mock/detail/tmdb-person-oscar-isaac.jpg"
      },
      {
        "name": "Zendaya",
        "role": "Chani",
        "portrait": "/mock/detail/tmdb-person-zendaya.jpg"
      },
      {
        "name": "Jason Momoa",
        "role": "Duncan Idaho",
        "portrait": "/mock/detail/tmdb-person-jason-momoa.jpg"
      }
    ],
    "backdropUrl": "/mock/detail/tmdb-backdrop-dune.jpg",
    "rating": "7.8",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "4K HDR",
      "filename": "Dune.2021.2160p.UHD.BluRay.REMUX.HEVC.HDR.TrueHD.7.1.mkv",
      "sizeBytes": 72600000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [
          "HDR10"
        ],
        "bitrate": 57200000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "TrueHD",
          "channels": "7.1",
          "atmos": true,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-interstellar": {
    "originalTitle": "Interstellar",
    "overview": "近未来的地球黄沙遍野，基础农作物相继因枯萎病灭绝，人类在沙尘暴的肆虐下倒数着所剩不多的光景。前 NASA 宇航员库珀发现女儿书房里的异常重力现象，并由此进入一项秘密拯救人类的计划。他忍痛告别家人，与艾米莉亚·布兰德等专家穿越土星附近的虫洞，前往遥远星系寻找适合人类居住的新家园。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Christopher Nolan",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-christopher-nolan.jpg"
      },
      {
        "name": "Matthew McConaughey",
        "role": "Cooper",
        "portrait": "/mock/detail/tmdb-person-matthew-mcconaughey.jpg"
      },
      {
        "name": "Anne Hathaway",
        "role": "Amelia Brand",
        "portrait": "/mock/detail/tmdb-person-anne-hathaway.jpg"
      },
      {
        "name": "Michael Caine",
        "role": "Professor Brand",
        "portrait": "/mock/detail/tmdb-person-michael-caine.jpg"
      },
      {
        "name": "Jessica Chastain",
        "role": "Murph",
        "portrait": "/mock/detail/tmdb-person-jessica-chastain.jpg"
      },
      {
        "name": "Mackenzie Foy",
        "role": "Murph（10岁）",
        "portrait": "/mock/detail/tmdb-person-mackenzie-foy.jpg"
      },
      {
        "name": "Timothée Chalamet",
        "role": "Tom（15岁）",
        "portrait": "/mock/detail/tmdb-person-timothee-chalamet.jpg"
      }
    ],
    "backdropUrl": "/mock/detail/tmdb-backdrop-interstellar.jpg",
    "rating": "8.5",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "1080p",
      "filename": "Interstellar.2014.1080p.BluRay.mkv",
      "sizeBytes": 35200000000,
      "container": "Matroska",
      "video": {
        "codec": "H.264",
        "width": 1920,
        "height": 1080,
        "bitDepth": 8,
        "hdrFormats": [],
        "bitrate": 25400000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "DTS-HD MA",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-oppenheimer": {
    "originalTitle": "Oppenheimer",
    "overview": "第二次世界大战期间，理论物理学家 J. 罗伯特·奥本海默受命领导曼哈顿计划，在新墨西哥州洛斯阿拉莫斯集结顶尖科学家研制原子弹。科学突破改变了战争进程，也让他直面核武器带来的道德重负；战后，他的声望与忠诚又在政治审查中遭到严峻考验。",
    "certification": "R",
    "cast": [
      {
        "name": "Christopher Nolan",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-christopher-nolan.jpg"
      },
      {
        "name": "Cillian Murphy",
        "role": "J. Robert Oppenheimer",
        "portrait": "/mock/detail/tmdb-person-cillian-murphy.jpg"
      },
      {
        "name": "Emily Blunt",
        "role": "Kitty Oppenheimer",
        "portrait": "/mock/detail/tmdb-person-emily-blunt.jpg"
      },
      {
        "name": "Matt Damon",
        "role": "Leslie Groves",
        "portrait": "/mock/detail/tmdb-person-matt-damon.jpg"
      },
      {
        "name": "Robert Downey Jr.",
        "role": "Lewis Strauss",
        "portrait": "/mock/detail/tmdb-person-robert-downey-jr.jpg"
      },
      {
        "name": "Florence Pugh",
        "role": "Jean Tatlock",
        "portrait": "/mock/detail/tmdb-person-florence-pugh.jpg"
      },
      {
        "name": "Josh Hartnett",
        "role": "Ernest Lawrence",
        "portrait": "/mock/detail/tmdb-person-josh-hartnett.jpg"
      }
    ],
    "backdropUrl": "/mock/detail/tmdb-backdrop-oppenheimer.jpg",
    "rating": "8.0",
    "sourceId": "source-nextcloud",
    "sourceName": "我的 Nextcloud",
    "resource": {
      "quality": "4K HDR",
      "filename": "Oppenheimer.2023.2160p.BluRay.REMUX.HDR.mkv",
      "sizeBytes": 88100000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [
          "HDR10"
        ],
        "bitrate": 59600000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "DTS-HD MA",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-dune-part-two": {
    "originalTitle": "Dune: Part Two",
    "overview": "《沙丘2》承接第一部剧情，讲述保罗·厄崔迪被帕迪沙皇帝和哈克南人联手灭族后，在厄拉科斯星球遇到弗雷曼女战士契妮并加入弗雷曼人展开传奇旅程。保罗与让他家破人亡的阴谋家们开战，同时面临着一生所爱与已知宇宙命运的两难选择。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Denis Villeneuve",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-denis-villeneuve.jpg"
      },
      {
        "name": "Timothée Chalamet",
        "role": "Paul Atreides",
        "portrait": "/mock/detail/tmdb-person-timothee-chalamet.jpg"
      },
      {
        "name": "Zendaya",
        "role": "Chani",
        "portrait": "/mock/detail/tmdb-person-zendaya.jpg"
      },
      {
        "name": "Rebecca Ferguson",
        "role": "Lady Jessica",
        "portrait": "/mock/detail/tmdb-person-rebecca-ferguson.jpg"
      },
      {
        "name": "Javier Bardem",
        "role": "Stilgar",
        "portrait": "/mock/detail/tmdb-person-javier-bardem.jpg"
      },
      {
        "name": "Florence Pugh",
        "role": "Princess Irulan",
        "portrait": "/mock/detail/tmdb-person-florence-pugh.jpg"
      },
      {
        "name": "Austin Butler",
        "role": "Feyd-Rautha",
        "portrait": "/mock/detail/tmdb-person-austin-butler.jpg"
      }
    ],
    "backdropUrl": "/mock/detail/tmdb-backdrop-dune-part-two.jpg",
    "rating": "8.1",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "4K HDR",
      "filename": "Dune.Part.Two.2024.2160p.HDR.mkv",
      "sizeBytes": 79800000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [
          "HDR10"
        ],
        "bitrate": 59800000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "TrueHD",
          "channels": "7.1",
          "atmos": true,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-blade-runner-2049": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-blade-runner-2049.jpg",
    "originalTitle": "Blade Runner 2049",
    "overview": "2049年的洛杉矶，复制人警探K负责追捕逃亡的旧型号复制人。一次例行任务中，他发现了一条可能动摇人类与复制人关系的线索。为查明这段被掩埋的往事，K穿行于城市与荒原，寻找失踪多年的前银翼杀手瑞克·戴克，并开始重新审视自己的身份。",
    "certification": "R",
    "cast": [
      {
        "name": "Denis Villeneuve",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-denis-villeneuve.jpg"
      },
      {
        "name": "Ryan Gosling",
        "role": "K",
        "portrait": ""
      },
      {
        "name": "Harrison Ford",
        "role": "Rick Deckard",
        "portrait": ""
      },
      {
        "name": "Ana de Armas",
        "role": "Joi",
        "portrait": ""
      },
      {
        "name": "Robin Wright",
        "role": "Joshi",
        "portrait": ""
      }
    ],
    "rating": "7.6",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "4K",
      "filename": "Blade.Runner.2049.2017.2160p.BluRay.mkv",
      "sizeBytes": 63500000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [],
        "bitrate": 47500000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "DTS-HD MA",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-arrival": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-arrival.jpg",
    "originalTitle": "Arrival",
    "overview": "十二艘神秘飞船同时出现在地球各地，语言学家路易丝·班克斯受邀加入军方组织的接触团队，与物理学家伊恩·唐纳利一起尝试理解来访者的语言。面对不断升级的国际紧张局势，他们必须在有限时间里建立沟通，弄清对方的来意，避免恐惧与误解引发冲突。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Denis Villeneuve",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-denis-villeneuve.jpg"
      },
      {
        "name": "Amy Adams",
        "role": "Louise Banks",
        "portrait": ""
      },
      {
        "name": "Jeremy Renner",
        "role": "Ian Donnelly",
        "portrait": ""
      },
      {
        "name": "Forest Whitaker",
        "role": "Colonel Weber",
        "portrait": ""
      },
      {
        "name": "Michael Stuhlbarg",
        "role": "Agent Halpern",
        "portrait": ""
      }
    ],
    "rating": "7.6",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  },
  "movie-the-batman": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-the-batman.jpg",
    "originalTitle": "The Batman",
    "overview": "成为蝙蝠侠的第二年，布鲁斯·韦恩仍在哥谭市的阴影中摸索打击犯罪的方式。一连串针对城市权贵的案件留下了指向他的谜题，迫使他与警探戈登合作调查。在追寻线索的过程中，他遇见各怀目的的人物，也必须面对家族历史与城市腐败之间的复杂联系。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Matt Reeves",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Robert Pattinson",
        "role": "Bruce Wayne / Batman",
        "portrait": ""
      },
      {
        "name": "Zoë Kravitz",
        "role": "Selina Kyle",
        "portrait": ""
      },
      {
        "name": "Jeffrey Wright",
        "role": "James Gordon",
        "portrait": ""
      },
      {
        "name": "Paul Dano",
        "role": "Edward Nashton",
        "portrait": ""
      }
    ],
    "rating": "7.7",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "4K HDR",
      "filename": "The.Batman.2022.2160p.HDR.mkv",
      "sizeBytes": 81300000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [
          "HDR10"
        ],
        "bitrate": 55100000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "TrueHD",
          "channels": "7.1",
          "atmos": true,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-inception": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-inception.jpg",
    "originalTitle": "Inception",
    "overview": "柯布擅长潜入他人的梦境窃取秘密，却因个人困境无法回家与孩子团聚。一位委托人向他提出危险的交易：不再窃取信息，而是在目标的潜意识中植入一个想法。柯布召集团队，设计层层相扣的梦境计划，同时努力控制不断侵入任务的私人记忆。",
    "certification": "PG-13",
    "cast": [
      {
        "name": "Christopher Nolan",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-christopher-nolan.jpg"
      },
      {
        "name": "Leonardo DiCaprio",
        "role": "Dom Cobb",
        "portrait": ""
      },
      {
        "name": "Joseph Gordon-Levitt",
        "role": "Arthur",
        "portrait": ""
      },
      {
        "name": "Elliot Page",
        "role": "Ariadne",
        "portrait": ""
      },
      {
        "name": "Tom Hardy",
        "role": "Eames",
        "portrait": ""
      },
      {
        "name": "Cillian Murphy",
        "role": "Robert Fischer",
        "portrait": "/mock/detail/tmdb-person-cillian-murphy.jpg"
      },
      {
        "name": "Michael Caine",
        "role": "Miles",
        "portrait": "/mock/detail/tmdb-person-michael-caine.jpg"
      }
    ],
    "rating": "8.4",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  },
  "movie-prisoners": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-prisoners.jpg",
    "originalTitle": "Prisoners",
    "overview": "感恩节聚会后，凯勒·多佛的小女儿与邻居家的女孩一同失踪，一辆曾停在附近的房车成为调查线索。警探洛基循着零散证据追查，焦急的父亲却越来越难以接受等待。随着搜寻陷入困境，两个家庭承受着巨大的压力，信任、判断与道德界限也受到考验。",
    "certification": "R",
    "cast": [
      {
        "name": "Denis Villeneuve",
        "role": "导演",
        "portrait": "/mock/detail/tmdb-person-denis-villeneuve.jpg"
      },
      {
        "name": "Hugh Jackman",
        "role": "Keller Dover",
        "portrait": ""
      },
      {
        "name": "Jake Gyllenhaal",
        "role": "Detective Loki",
        "portrait": ""
      },
      {
        "name": "Viola Davis",
        "role": "Nancy Birch",
        "portrait": ""
      },
      {
        "name": "Maria Bello",
        "role": "Grace Dover",
        "portrait": ""
      }
    ],
    "rating": "8.1",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  },
  "movie-1917": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-1917.jpg",
    "originalTitle": "1917",
    "overview": "第一次世界大战期间，两名年轻的英国士兵斯科菲尔德和布雷克接到紧急任务：穿越敌军控制的地带，将停止进攻的命令送到前线部队。通信中断，时间所剩无几，而布雷克的兄长也在即将出击的队伍中。两人必须越过战壕、废墟与陌生村庄，在战场的不确定中继续前行。",
    "certification": "R",
    "cast": [
      {
        "name": "Sam Mendes",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "George MacKay",
        "role": "William Schofield",
        "portrait": ""
      },
      {
        "name": "Dean-Charles Chapman",
        "role": "Tom Blake",
        "portrait": ""
      },
      {
        "name": "Mark Strong",
        "role": "Captain Smith",
        "portrait": ""
      },
      {
        "name": "Andrew Scott",
        "role": "Lieutenant Leslie",
        "portrait": ""
      }
    ],
    "rating": "8.0",
    "sourceId": "source-nextcloud",
    "sourceName": "我的 Nextcloud",
    "resource": null
  },
  "movie-mad-max-fury-road": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-mad-max-fury-road.jpg",
    "originalTitle": "Mad Max: Fury Road",
    "overview": "在水源与燃料极度匮乏的荒漠世界，独行者麦克斯被卷入一场逃亡。驾驶重型战车的弗瑞奥萨试图带领几名女性离开暴君的控制，身后则是穷追不舍的武装车队。原本只求自保的麦克斯不得不与她们合作，在沙尘与追逐中寻找生路，并决定是否重新信任他人。",
    "certification": "R",
    "cast": [
      {
        "name": "George Miller",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Tom Hardy",
        "role": "Max Rockatansky",
        "portrait": ""
      },
      {
        "name": "Charlize Theron",
        "role": "Imperator Furiosa",
        "portrait": ""
      },
      {
        "name": "Nicholas Hoult",
        "role": "Nux",
        "portrait": ""
      },
      {
        "name": "Hugh Keays-Byrne",
        "role": "Immortan Joe",
        "portrait": ""
      }
    ],
    "rating": "7.6",
    "sourceId": "source-home-nas",
    "sourceName": "家庭 NAS",
    "resource": {
      "quality": "4K HDR",
      "filename": "Mad.Max.Fury.Road.2015.2160p.HDR.mkv",
      "sizeBytes": 55700000000,
      "container": "Matroska",
      "video": {
        "codec": "HEVC",
        "width": 3840,
        "height": 2160,
        "bitDepth": 10,
        "hdrFormats": [
          "HDR10"
        ],
        "bitrate": 56000000,
        "frameRate": 23.976
      },
      "audioTracks": [
        {
          "codec": "TrueHD",
          "channels": "7.1",
          "atmos": true,
          "language": "eng"
        },
        {
          "codec": "AC-3",
          "channels": "5.1",
          "atmos": false,
          "language": "eng"
        }
      ],
      "subtitleTracks": [
        {
          "codec": "PGS",
          "language": "zh"
        },
        {
          "codec": "PGS",
          "language": "eng"
        }
      ]
    }
  },
  "movie-parasite": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-parasite.jpg",
    "originalTitle": "기생충",
    "overview": "金基宇一家住在狭小的半地下室，依靠零工维持生活。一次朋友的介绍让他获得为富裕的朴家女儿补习的机会，也让两个生活迥异的家庭产生交集。随着接触加深，一家人开始设法改善处境，而看似体面的工作与日常相处背后，阶层差距带来的不安逐渐浮现。",
    "certification": "R",
    "cast": [
      {
        "name": "Bong Joon-ho",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Song Kang-ho",
        "role": "Kim Ki-taek",
        "portrait": ""
      },
      {
        "name": "Lee Sun-kyun",
        "role": "Park Dong-ik",
        "portrait": ""
      },
      {
        "name": "Cho Yeo-jeong",
        "role": "Choi Yeon-gyo",
        "portrait": ""
      },
      {
        "name": "Choi Woo-shik",
        "role": "Kim Ki-woo",
        "portrait": ""
      }
    ],
    "rating": "",
    "sourceId": "source-nextcloud",
    "sourceName": "我的 Nextcloud",
    "resource": null
  },
  "movie-whiplash": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-whiplash.jpg",
    "originalTitle": "Whiplash",
    "overview": "年轻鼓手安德鲁进入一所顶尖音乐学院，渴望成为出色的爵士乐演奏者。严厉的指挥弗莱彻将他选入乐团，也让他置身于近乎苛刻的训练与竞争之中。为了证明自己的天赋，安德鲁不断压缩生活的其他部分，逐渐面对追求卓越的代价，以及师生关系中令人不安的压力。",
    "certification": "R",
    "cast": [
      {
        "name": "Damien Chazelle",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Miles Teller",
        "role": "Andrew Neiman",
        "portrait": ""
      },
      {
        "name": "J. K. Simmons",
        "role": "Terence Fletcher",
        "portrait": ""
      },
      {
        "name": "Paul Reiser",
        "role": "Jim Neiman",
        "portrait": ""
      },
      {
        "name": "Melissa Benoist",
        "role": "Nicole",
        "portrait": ""
      }
    ],
    "rating": "",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  },
  "movie-gone-girl": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-gone-girl.jpg",
    "originalTitle": "Gone Girl",
    "overview": "结婚五周年纪念日，尼克回到家中，发现妻子艾米不知所踪，屋内留下令人不安的痕迹。警方展开搜寻，媒体的关注也迅速聚集到这对夫妇身上。随着两人的婚姻经历被不断审视，尼克必须应对来自公众与调查的压力，而一段看似理想的关系开始显露裂缝。",
    "certification": "R",
    "cast": [
      {
        "name": "David Fincher",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Ben Affleck",
        "role": "Nick Dunne",
        "portrait": ""
      },
      {
        "name": "Rosamund Pike",
        "role": "Amy Dunne",
        "portrait": ""
      },
      {
        "name": "Carrie Coon",
        "role": "Margo Dunne",
        "portrait": ""
      },
      {
        "name": "Kim Dickens",
        "role": "Detective Rhonda Boney",
        "portrait": ""
      }
    ],
    "rating": "",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  },
  "movie-ex-machina": {
    "backdropUrl": "/mock/detail/tmdb-backdrop-ex-machina.jpg",
    "originalTitle": "Ex Machina",
    "overview": "年轻程序员凯莱布获邀前往公司创始人内森位于偏远山林的住所，参与一项保密实验：与具有人形外表的人工智能艾娃交流，评估她是否拥有独立意识。在封闭的环境里，日常测试逐渐变得复杂，凯莱布开始思考眼前的情感、信任与控制究竟意味着什么。",
    "certification": "R",
    "cast": [
      {
        "name": "Alex Garland",
        "role": "导演",
        "portrait": ""
      },
      {
        "name": "Domhnall Gleeson",
        "role": "Caleb Smith",
        "portrait": ""
      },
      {
        "name": "Alicia Vikander",
        "role": "Ava",
        "portrait": ""
      },
      {
        "name": "Oscar Isaac",
        "role": "Nathan Bateman",
        "portrait": "/mock/detail/tmdb-person-oscar-isaac.jpg"
      },
      {
        "name": "Sonoya Mizuno",
        "role": "Kyoko",
        "portrait": ""
      }
    ],
    "rating": "",
    "sourceId": "source-alist",
    "sourceName": "AList · 迅雷云盘",
    "resource": null
  }
}
