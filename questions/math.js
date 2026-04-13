// MATH — 150 questions, merged & deduplicated
// Last updated: 2026-04-13

export default [
  {
    "id": "math-001",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "有理数运算"
    ],
    "question": "计算：(-3) + (-5) - (+2)的结果是：",
    "options": [
      "-10",
      "-6",
      "6",
      "10"
    ],
    "answer": "-10",
    "explanation": "(-3)+(-5)=-8，-8-(+2)=-10"
  },
  {
    "id": "math-002",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数运算",
      "平方根"
    ],
    "question": "平方根为±4的数是____。",
    "options": null,
    "answer": "16",
    "explanation": "平方根是±4，则这个数是(±4)²=16"
  },
  {
    "id": "math-003",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元二次方程"
    ],
    "question": "解方程：x² - 5x + 6 = 0，正确的是：",
    "options": [
      "x=1或x=6",
      "x=2或x=3",
      "x=-2或x=-3",
      "x=1或x=-6"
    ],
    "answer": "x=2或x=3",
    "explanation": "因式分解：(x-2)(x-3)=0，所以x=2或x=3"
  },
  {
    "id": "math-004",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "代数式化简"
    ],
    "question": "化简：3(2x - 1) - 2(x - 3) = ____",
    "options": null,
    "answer": "4x + 3",
    "explanation": "3(2x-1)=6x-3，-2(x-3)=-2x+6，合并：4x+3"
  },
  {
    "id": "math-005",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 2x - 3 > 5 的解集在数轴上表示为：",
    "options": [
      "原点左侧",
      "原点右侧",
      "包括原点",
      "无解"
    ],
    "answer": "原点右侧",
    "explanation": "2x-3>5 → 2x>8 → x>4，在数轴上表示为原点右侧"
  },
  {
    "id": "math-006",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y = -2x + 3，y随x增大而____。",
    "options": [
      "增大",
      "减小",
      "不变",
      "先增后减"
    ],
    "answer": "减小",
    "explanation": "一次函数y=kx+b，k<0时y随x增大而减小。这里k=-2<0"
  },
  {
    "id": "math-007",
    "type": "choice",
    "subject": "math",
    "difficulty": 3,
    "grade": 8,
    "knowledgeTags": [
      "二次函数图像"
    ],
    "question": "二次函数 y = x² - 4x + 3 的顶点坐标是：",
    "options": [
      "(2,-1)",
      "(2,1)",
      "(-2,-1)",
      "(-2,1)"
    ],
    "answer": "(2,-1)",
    "explanation": "顶点x坐标=-b/2a=4/2=2，代入：y=4-8+3=-1，顶点(2,-1)"
  },
  {
    "id": "math-008",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形内角和"
    ],
    "question": "在△ABC中，∠A=50°，∠B=60°，则∠C=____°。",
    "options": [
      "60",
      "70",
      "80",
      "90"
    ],
    "answer": "70",
    "explanation": "三角形内角和为180°，∠C=180°-50°-60°=70°"
  },
  {
    "id": "math-009",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "勾股定理"
    ],
    "question": "直角三角形的两直角边分别为5和12，则斜边长为：",
    "options": [
      "11",
      "12",
      "13",
      "17"
    ],
    "answer": "13",
    "explanation": "勾股定理：斜边=√(5²+12²)=√(25+144)=√169=13"
  },
  {
    "id": "math-010",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "全等三角形"
    ],
    "question": "在△ABC和△DEF中，已知AB=DE，∠A=∠D，AC=DF，则这两个三角形_____（填'全等'或'不全等'）。",
    "options": null,
    "answer": "全等",
    "explanation": "两边及其夹角相等(SAS)，两三角形全等"
  },
  {
    "id": "math-011",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "圆的性质"
    ],
    "question": "圆的半径为5，则其周长为（结果保留π）：",
    "options": [
      "10π",
      "25π",
      "5π",
      "10"
    ],
    "answer": "10π",
    "explanation": "圆周长C=2πr=2π×5=10π"
  },
  {
    "id": "math-012",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "空间几何体体积"
    ],
    "question": "底面半径为3、高为4的圆锥的体积是____。（结果保留π）",
    "options": null,
    "answer": "12π",
    "explanation": "圆锥体积V=1/3πr²h=1/3×π×9×4=12π"
  },
  {
    "id": "math-013",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "相似三角形"
    ],
    "question": "两个相似三角形的相似比是3:2，较大三角形的面积是27cm²，则较小三角形的面积是____cm²。",
    "options": [
      "12",
      "18",
      "8",
      "16"
    ],
    "answer": "12",
    "explanation": "面积比=相似比的平方=9:4，27:x=9:4，x=12cm²"
  },
  {
    "id": "math-014",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "图形变换",
      "平移"
    ],
    "question": "点(2,3)向右平移3个单位，再向上平移2个单位，所得点的坐标是____。",
    "options": null,
    "answer": "(5,5)",
    "explanation": "横坐标+3，纵坐标+2，得(2+3,3+2)=(5,5)"
  },
  {
    "id": "math-015",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "平均数"
    ],
    "question": "数据2、4、6、8、10的平均数是：",
    "options": [
      "5",
      "6",
      "7",
      "8"
    ],
    "answer": "6",
    "explanation": "平均数=(2+4+6+8+10)/5=30/5=6"
  },
  {
    "id": "math-016",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "中位数"
    ],
    "question": "数据3、1、4、2、5的中位数是：",
    "options": [
      "2",
      "3",
      "3.5",
      "4"
    ],
    "answer": "3",
    "explanation": "排序后：1,2,3,4,5，中位数是第3个数，即3"
  },
  {
    "id": "math-017",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "概率"
    ],
    "question": "袋中有3个红球和2个白球，它们除颜色外完全相同。从中任意摸出一球，摸到红球的概率是：",
    "options": [
      "3/5",
      "2/5",
      "1/2",
      "1/3"
    ],
    "answer": "3/5",
    "explanation": "总球数5，红球3，概率=3/5"
  },
  {
    "id": "math-018",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "频数分布"
    ],
    "question": "某班50名学生数学成绩统计：得优的有10人，良的有20人，及格的有15人，不及格的有5人。优的频率是____。",
    "options": null,
    "answer": "0.2",
    "explanation": "频率=频数/总数=10/50=0.2"
  },
  {
    "id": "math-019",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "方程 2x - 5 = 3 的解是：",
    "options": [
      "x=1",
      "x=2",
      "x=3",
      "x=4"
    ],
    "answer": "x=4",
    "explanation": "2x - 5 = 3 → 2x = 8 → x = 4"
  },
  {
    "id": "math-020",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点 P(3, -2) 到 x 轴的距离是：",
    "options": [
      "2",
      "3",
      "5",
      "√13"
    ],
    "answer": "2",
    "explanation": "点到x轴的距离等于纵坐标的绝对值，即 |-2| = 2"
  },
  {
    "id": "math-021",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y = -2x + 3 的图像经过第几象限：",
    "options": [
      "一、二、三",
      "一、二、四",
      "二、三、四",
      "一、三、四"
    ],
    "answer": "一、二、四",
    "explanation": "k=-2<0，经过二、四象限；b=3>0，与y轴正半轴相交，经过一、二、四象限"
  },
  {
    "id": "math-022",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的内角和是：",
    "options": [
      "90°",
      "180°",
      "270°",
      "360°"
    ],
    "answer": "180°",
    "explanation": "三角形内角和等于180°"
  },
  {
    "id": "math-023",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算 (a+b)² 的结果正确的是：",
    "options": [
      "a²+b²",
      "a²+2ab+b²",
      "a²-2ab+b²",
      "a²+b²+2ab"
    ],
    "answer": "a²+2ab+b²",
    "explanation": "完全平方公式：(a+b)² = a² + 2ab + b²"
  },
  {
    "id": "math-024",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "下列是无理数的是：",
    "options": [
      "√4",
      "√2",
      "0.5",
      "3.14"
    ],
    "answer": "√2",
    "explanation": "√2 不能表示为两个整数之比，是无限不循环小数，属于无理数"
  },
  {
    "id": "math-025",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "分式 x/(x-1) 中，x 的取值不能是：",
    "options": [
      "0",
      "1",
      "2",
      "-1"
    ],
    "answer": "1",
    "explanation": "分母不能为零，所以 x-1≠0，即 x≠1"
  },
  {
    "id": "math-026",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "√169 = ___",
    "answer": "13",
    "explanation": "13 × 13 = 169"
  },
  {
    "id": "math-027",
    "type": "choice",
    "subject": "math",
    "difficulty": 3,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "解方程组 x+y=5, 2x-y=1，x 的值是：",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "answer": "2",
    "explanation": "相加得 3x = 6，x = 2，代入得 y = 3"
  },
  {
    "id": "math-028",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "a³ · a² = ",
    "options": [
      "a⁵",
      "a⁶",
      "a⁹",
      "2a⁵"
    ],
    "answer": "a⁵",
    "explanation": "同底数幂相乘，底数不变，指数相加：a³⁺² = a⁵"
  },
  {
    "id": "math-029",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "计算：|−3| = _____",
    "options": null,
    "answer": "3",
    "explanation": "绝对值等于它的相反数，|-3|=3"
  },
  {
    "id": "math-030",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点(−2,3)在第_____象限",
    "options": null,
    "answer": "二",
    "explanation": "x负y正，第二象限"
  },
  {
    "id": "math-031",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "化简：3a²b − 5a²b =",
    "options": null,
    "answer": "−2a²b",
    "explanation": "合并同类项，系数相加减：3-5=-2"
  },
  {
    "id": "math-032",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "方程 3(x−2)=12 的解是 x=_____",
    "options": null,
    "answer": "4",
    "explanation": "3(x-2)=12 → x-2=4 → x=4"
  },
  {
    "id": "math-033",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "(a²)³ = ",
    "options": null,
    "answer": "a⁶",
    "explanation": "幂的乘方，指数相乘：2×3=6"
  },
  {
    "id": "math-034",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "等腰三角形的顶角为50°，底角为_____",
    "options": null,
    "answer": "65°",
    "explanation": "三角形内角和180°，两个底角相等：(180-50)/2=65°"
  },
  {
    "id": "math-035",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "下列是有理数的是：",
    "options": null,
    "answer": "0.333...",
    "explanation": "无限不循环小数为无理数，0.333...=1/3是有理数"
  },
  {
    "id": "math-036",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y=2x−3，当 x=4 时，y=_____",
    "options": null,
    "answer": "5",
    "explanation": "y=2×4-3=8-3=5"
  },
  {
    "id": "math-037",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "√49 = _____",
    "options": null,
    "answer": "7",
    "explanation": "7×7=49"
  },
  {
    "id": "math-038",
    "type": "fill",
    "subject": "math",
    "difficulty": 3,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "解方程组：3x+2y=7, x−y=4，x=_____",
    "options": null,
    "answer": "3",
    "explanation": "由x-y=4得x=y+4，代入3(y+4)+2y=7→5y=-5→y=-1→x=3"
  },
  {
    "id": "math-039",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "直角三角形两锐角和为_____",
    "options": null,
    "answer": "90°",
    "explanation": "直角三角形内角和180°，减去直角90°"
  },
  {
    "id": "math-040",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：2x·3x² = ",
    "options": null,
    "answer": "6x³",
    "explanation": "单项式乘以单项式，系数相乘，同底数幂相加：2×3·x¹⁺²=6x³"
  },
  {
    "id": "math-041",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "下列各式中，是最简二次根式的是：",
    "options": null,
    "answer": "√7",
    "explanation": "√7不能再化简，是最简二次根式；√12=2√3，√18=3√2"
  },
  {
    "id": "math-042",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "分式 (x²−1)/(x−1) 化简为：",
    "options": null,
    "answer": "x+1",
    "explanation": "x²-1=(x+1)(x-1)，约去(x-1)得x+1"
  },
  {
    "id": "math-043",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：10⁻² = ",
    "options": null,
    "answer": "0.01",
    "explanation": "负整数指数：10的负二次方等于1/100=0.01"
  },
  {
    "id": "math-044",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点P(−1,−2)到原点的距离是：",
    "options": null,
    "answer": "√5",
    "explanation": "距离=√((-1)²+(-2)²)=√5"
  },
  {
    "id": "math-045",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的三条高交于一点，这一点叫三角形的_____",
    "options": null,
    "answer": "垂心",
    "explanation": "三角形三条高交于垂心"
  },
  {
    "id": "math-046",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "正比例函数 y=kx，当 x=3 时 y=6，k=_____",
    "options": null,
    "answer": "2",
    "explanation": "6=k×3，k=2"
  },
  {
    "id": "math-047",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "多项式 2x²−3x+1 是_____次多项式",
    "options": null,
    "answer": "二",
    "explanation": "最高次数是2次"
  },
  {
    "id": "math-048",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 2x−1>5 的解集是：",
    "options": null,
    "answer": "x>3",
    "explanation": "2x-1>5 → 2x>6 → x>3"
  },
  {
    "id": "math-049",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "等边三角形每个内角的度数是_____",
    "options": null,
    "answer": "60°",
    "explanation": "等边三角形三个角相等，180°/3=60°"
  },
  {
    "id": "math-050",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "方程 x²=4 的解是：",
    "options": null,
    "answer": "x=2或x=-2",
    "explanation": "直接开平方得x=±2"
  },
  {
    "id": "math-051",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "0.0001 用科学记数法表示为：",
    "options": null,
    "answer": "10⁻⁴",
    "explanation": "0.0001=1/10000=10⁻⁴"
  },
  {
    "id": "math-052",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "已知点A(1,2)，B(3,2)，则AB=_____",
    "options": null,
    "answer": "2",
    "explanation": "横坐标差=|1-3|=2，纵坐标相同"
  },
  {
    "id": "math-053",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "在△ABC中，∠A=90°，∠B=35°，则∠C=_____",
    "options": null,
    "answer": "55°",
    "explanation": "内角和180°，180-90-35=55°"
  },
  {
    "id": "math-054",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "因式分解：x²−9 = ",
    "options": null,
    "answer": "(x+3)(x−3)",
    "explanation": "平方差公式：a²-b²=(a+b)(a-b)"
  },
  {
    "id": "math-055",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：a⁵ ÷ a² = ",
    "options": null,
    "answer": "a³",
    "explanation": "同底数幂相除，指数相减：5-2=3"
  },
  {
    "id": "math-056",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y=−x+2 的斜率是：",
    "options": null,
    "answer": "−1",
    "explanation": "斜率即x的系数，为-1"
  },
  {
    "id": "math-057",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "数轴上的点与实数_____对应",
    "options": null,
    "answer": "一一",
    "explanation": "数轴上的每个点唯一对应一个实数"
  },
  {
    "id": "math-058",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "在△ABC中，AB=AC，则△ABC是_____三角形",
    "options": null,
    "answer": "等腰",
    "explanation": "两边相等的三角形是等腰三角形"
  },
  {
    "id": "math-059",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "若 2x=6，则 x=_____",
    "options": null,
    "answer": "3",
    "explanation": "等式两边除以2：x=3"
  },
  {
    "id": "math-060",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "当 x=_____ 时，分式 1/(x−2) 无意义",
    "options": null,
    "answer": "2",
    "explanation": "分母为零时分式无意义，x-2=0即x=2"
  },
  {
    "id": "math-061",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "(−2)³ = ",
    "options": null,
    "answer": "−8",
    "explanation": "(-2)×(-2)×(-2)=-8，负数的奇数次幂为负"
  },
  {
    "id": "math-062",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "若方程 3x+5=0，则 x=_____",
    "options": null,
    "answer": "−5/3",
    "explanation": "3x=-5，x=-5/3"
  },
  {
    "id": "math-063",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的外角和是_____",
    "options": null,
    "answer": "360°",
    "explanation": "多边形外角和均为360°"
  },
  {
    "id": "math-064",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：x²+5x+6 = ",
    "options": null,
    "answer": "(x+2)(x+3)",
    "explanation": "十字相乘法：常数项6=2×3，一次项系数5=2+3"
  },
  {
    "id": "math-065",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "1ⁿ = _____ (n为任意整数)",
    "options": null,
    "answer": "1",
    "explanation": "1的任何次幂都等于1"
  },
  {
    "id": "math-066",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点(0,−3)在_____上",
    "options": null,
    "answer": "y轴",
    "explanation": "x=0时点在y轴上"
  },
  {
    "id": "math-067",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "直角三角形斜边上的中线等于斜边的_____",
    "options": null,
    "answer": "一半",
    "explanation": "直角三角形斜边上的中线等于斜边的一半"
  },
  {
    "id": "math-068",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 −2x<4 的解集是：",
    "options": null,
    "answer": "x>−2",
    "explanation": "两边除以-2（负数变号）：x>-2"
  },
  {
    "id": "math-069",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "多项式 3x²y−2xy² 是_____项式",
    "options": null,
    "answer": "二",
    "explanation": "有两项，是二项式"
  },
  {
    "id": "math-070",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "函数 y=3−2x，当 x 增大时，y_____",
    "options": null,
    "answer": "减小",
    "explanation": "k=-2<0，y随x增大而减小"
  },
  {
    "id": "math-071",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "π 是_____数",
    "options": null,
    "answer": "无理",
    "explanation": "π是无限不循环小数，属于无理数"
  },
  {
    "id": "math-072",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "若 x+y=5 且 x−y=1，则 x=_____",
    "options": null,
    "answer": "3",
    "explanation": "两式相加：2x=6，x=3"
  },
  {
    "id": "math-073",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形任意两边之和_____第三边",
    "options": null,
    "answer": "大于",
    "explanation": "三角形两边之和大于第三边"
  },
  {
    "id": "math-074",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：(−a³)² = ",
    "options": null,
    "answer": "a⁶",
    "explanation": "积的乘方：(-1)²·(a³)²=a⁶"
  },
  {
    "id": "math-075",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "a⁰ = _____ (a≠0)",
    "options": null,
    "answer": "1",
    "explanation": "任何非零实数的零次幂等于1"
  },
  {
    "id": "math-076",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：2x²−8 = ",
    "options": null,
    "answer": "2(x+2)(x−2)",
    "explanation": "先提公因式2，再用平方差公式"
  },
  {
    "id": "math-077",
    "type": "fill",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "有一个角是60°的等腰三角形是_____三角形",
    "options": null,
    "answer": "等边",
    "explanation": "等腰三角形的一个角为60°时，三个角都是60°"
  },
  {
    "id": "math-078",
    "type": "fill",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点P(3,−4)关于x轴对称的点坐标是：",
    "options": null,
    "answer": "(3,4)",
    "explanation": "关于x轴对称：x不变，y变为相反数"
  },
  {
    "id": "math-079",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "在三角形ABC中，角A=90度，角B=45度，则角C=_____",
    "options": [
      "45度",
      "90度",
      "135度",
      "30度"
    ],
    "answer": "45度",
    "explanation": "三角形内角和180度，180-90-45=45度"
  },
  {
    "id": "math-080",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "已知点A(2,3)，B(-1,3)，则AB的长度为_____",
    "options": [
      "1",
      "2",
      "3",
      "6"
    ],
    "answer": "3",
    "explanation": "AB = |2-(-1)| = 3，横坐标差为3，纵坐标相同"
  },
  {
    "id": "math-081",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：(-a)的三次方 = _____",
    "options": [
      "-a³",
      "a³",
      "-a",
      "a"
    ],
    "answer": "-a³",
    "explanation": "(-a)³ = (-1)³·a³ = -a³"
  },
  {
    "id": "math-082",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式组 x>3 和 x<7 的解集是_____",
    "options": [
      "3<x<7",
      "x>3",
      "x<7",
      "无解"
    ],
    "answer": "3<x<7",
    "explanation": "两个不等式同时成立，取交集得 3<x<7"
  },
  {
    "id": "math-083",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：2³ = _____",
    "options": [
      "6",
      "8",
      "9",
      "16"
    ],
    "answer": "8",
    "explanation": "2³ = 2×2×2 = 8"
  },
  {
    "id": "math-084",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：x² - 4x + 4 = _____",
    "options": [
      "(x-2)²",
      "(x+2)²",
      "(x-4)(x+1)",
      "(x+1)(x-4)"
    ],
    "answer": "(x-2)²",
    "explanation": "完全平方公式：a²-2ab+b²=(a-b)²，这里x²-4x+4=(x-2)²"
  },
  {
    "id": "math-085",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "9的平方根是_____",
    "options": [
      "3",
      "-3",
      "±3",
      "81"
    ],
    "answer": "±3",
    "explanation": "平方根是指正负两个，√9=3，所以平方根是±3"
  },
  {
    "id": "math-086",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "解方程组 x+2y=7, 2x-y=4，x=_____",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "answer": "3",
    "explanation": "由第一个方程x=7-2y，代入第二个：2(7-2y)-y=4→14-4y-y=4→-5y=-10→y=2→x=3"
  },
  {
    "id": "math-087",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "等边三角形每个角是_____度",
    "options": [
      "30",
      "45",
      "60",
      "90"
    ],
    "answer": "60",
    "explanation": "等边三角形三个角相等，180÷3=60度"
  },
  {
    "id": "math-088",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "当 x=_____ 时，分式 (x-3)/(x+1) 的值为零",
    "options": [
      "3",
      "-3",
      "1",
      "-1"
    ],
    "answer": "3",
    "explanation": "分式为零的条件：分子=0且分母≠0，x-3=0得x=3，代入分母3+1=4≠0，所以x=3"
  },
  {
    "id": "math-089",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：5a - 3a = _____",
    "options": [
      "2",
      "2a",
      "8a",
      "15a"
    ],
    "answer": "2a",
    "explanation": "合并同类项，系数相减：5-3=2"
  },
  {
    "id": "math-090",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "函数 y = -3x + 2，y随x的增大而_____",
    "options": [
      "增大",
      "减小",
      "不变",
      "先增后减"
    ],
    "answer": "减小",
    "explanation": "k=-3<0，所以y随x增大而减小"
  },
  {
    "id": "math-091",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "任何不等于零的数的零次幂等于_____",
    "options": [
      "0",
      "1",
      "该数本身",
      "无穷大"
    ],
    "answer": "1",
    "explanation": "a⁰ = 1（a≠0），这是零指数幂的规定"
  },
  {
    "id": "math-092",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "方程 4x + 3 = 2x + 9 的解是 x=_____",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "answer": "3",
    "explanation": "4x-2x=9-3，2x=6，x=3"
  },
  {
    "id": "math-093",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点(0,5)在_____轴上",
    "options": [
      "x",
      "y",
      "原点",
      "无法确定"
    ],
    "answer": "y",
    "explanation": "x=0时点在y轴上"
  },
  {
    "id": "math-094",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的两边长分别为3和5，则第三边a的取值范围是_____",
    "options": [
      "2<a<8",
      "2<a<5",
      "3<a<8",
      "a>2"
    ],
    "answer": "2<a<8",
    "explanation": "三角形两边之和大于第三边，两边之差小于第三边：5-3<a<5+3，即2<a<8"
  },
  {
    "id": "math-095",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "最小的正整数是_____",
    "options": [
      "0",
      "1",
      "-1",
      "不存在"
    ],
    "answer": "1",
    "explanation": "正整数是大于0的整数，最小的是1；0不是正数也不是负数"
  },
  {
    "id": "math-096",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：3x² - 12 = _____",
    "options": [
      "3(x-2)²",
      "3(x+2)(x-2)",
      "(3x-6)(x+2)",
      "3x(x-4)"
    ],
    "answer": "3(x+2)(x-2)",
    "explanation": "先提公因式3：3(x²-4)，再用平方差公式x²-4=(x+2)(x-2)"
  },
  {
    "id": "math-097",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：10³ = _____",
    "options": [
      "30",
      "100",
      "1000",
      "10000"
    ],
    "answer": "1000",
    "explanation": "10³ = 10×10×10 = 1000"
  },
  {
    "id": "math-098",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "若x+y=5，且x-y=1，则x和y分别为_____",
    "options": [
      "3和2",
      "2和3",
      "4和1",
      "5和0"
    ],
    "answer": "3和2",
    "explanation": "相加：2x=6→x=3，相减：2y=4→y=2"
  },
  {
    "id": "math-099",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "单项式 -3x²y 的系数是_____",
    "options": [
      "-3",
      "3",
      "-2",
      "2"
    ],
    "answer": "-3",
    "explanation": "单项式中的数字因数叫系数，-3x²y的系数是-3"
  },
  {
    "id": "math-100",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 -x > 3 的解集是_____",
    "options": [
      "x > -3",
      "x < -3",
      "x > 3",
      "x < 3"
    ],
    "answer": "x < -3",
    "explanation": "两边除以-1（负数变号）：x < -3"
  },
  {
    "id": "math-101",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "(-2)的二次方 = _____",
    "options": [
      "4",
      "-4",
      "2",
      "-2"
    ],
    "answer": "4",
    "explanation": "(-2)² = (-2)×(-2) = 4，负负得正"
  },
  {
    "id": "math-102",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "正比例函数 y = kx，当 x=2 时 y=6，则 k=_____",
    "options": [
      "2",
      "3",
      "4",
      "12"
    ],
    "answer": "3",
    "explanation": "6 = k×2，k = 3"
  },
  {
    "id": "math-103",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的外角一定_____内角",
    "options": [
      "大于",
      "小于",
      "等于",
      "无法确定"
    ],
    "answer": "大于",
    "explanation": "三角形的一个外角大于任何一个与它不相邻的内角"
  },
  {
    "id": "math-104",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：(x+1)(x-1) = _____",
    "options": [
      "x²-1",
      "x²+1",
      "x²-2x+1",
      "x²+2x+1"
    ],
    "answer": "x²-1",
    "explanation": "平方差公式：(x+1)(x-1) = x²-1"
  },
  {
    "id": "math-105",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "下列是无理数的是_____",
    "options": [
      "√9",
      "π",
      "0.5",
      "1/3"
    ],
    "answer": "π",
    "explanation": "π是无限不循环小数，是无理数；√9=3是有理数"
  },
  {
    "id": "math-106",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "分式 (x²-4)/(x-2) 化简结果是_____",
    "options": [
      "x-2",
      "x+2",
      "x²-2",
      "x²+2"
    ],
    "answer": "x+2",
    "explanation": "x²-4=(x+2)(x-2)，约去(x-2)得x+2"
  },
  {
    "id": "math-107",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "a⁴ ÷ a² = _____",
    "options": [
      "a²",
      "a⁶",
      "a⁸",
      "1"
    ],
    "answer": "a²",
    "explanation": "同底数幂相除，指数相减：a⁴⁻² = a²"
  },
  {
    "id": "math-108",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点P(-3,4)到原点的距离是_____",
    "options": [
      "5",
      "7",
      "1",
      "25"
    ],
    "answer": "5",
    "explanation": "距离 = √((-3)²+4²) = √(9+16) = √25 = 5"
  },
  {
    "id": "math-109",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "多项式 4x² - 3x + 1 是_____次_____项式",
    "options": [
      "二，三",
      "二，二",
      "一，三",
      "三，四"
    ],
    "answer": "二，三",
    "explanation": "最高次数是2次，有三项，是二次三项式"
  },
  {
    "id": "math-110",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "方程 5 - 2x = 1 的解是 x=_____",
    "options": [
      "1",
      "2",
      "3",
      "-2"
    ],
    "answer": "2",
    "explanation": "-2x = 1-5 = -4，x = 2"
  },
  {
    "id": "math-111",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "直角三角形的两锐角和是_____度",
    "options": [
      "90",
      "180",
      "360",
      "45"
    ],
    "answer": "90",
    "explanation": "直角三角形内角和180度，直角90度，两锐角和为90度"
  },
  {
    "id": "math-112",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：x² + 6x + 9 = _____",
    "options": [
      "(x+3)²",
      "(x-3)²",
      "(x+9)(x+1)",
      "(x-9)(x+1)"
    ],
    "answer": "(x+3)²",
    "explanation": "完全平方公式：x²+2·x·3+3²=(x+3)²"
  },
  {
    "id": "math-113",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "(-1)的2026次方 = _____",
    "options": [
      "1",
      "-1",
      "0",
      "2026"
    ],
    "answer": "1",
    "explanation": "偶数次幂，(-1)²⁰²⁶ = 1"
  },
  {
    "id": "math-114",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y = 5x - 3 与x轴的交点是_____",
    "options": [
      "(0,-3)",
      "(3/5,0)",
      "(0,3/5)",
      "(-3,0)"
    ],
    "answer": "(3/5,0)",
    "explanation": "与x轴相交时y=0，0=5x-3，x=3/5，所以交点是(3/5,0)"
  },
  {
    "id": "math-115",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "数轴上的点与_____一一对应",
    "options": [
      "整数",
      "有理数",
      "实数",
      "自然数"
    ],
    "answer": "实数",
    "explanation": "数轴上的每个点唯一对应一个实数，实数与数轴上的点一一对应"
  },
  {
    "id": "math-116",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "方程组 x+2y=6, x-2y=2 的解是_____",
    "options": [
      "x=4,y=1",
      "x=2,y=2",
      "x=3,y=1.5",
      "x=1,y=4"
    ],
    "answer": "x=4,y=1",
    "explanation": "相加：2x=8→x=4，代入：4+2y=6→2y=2→y=1"
  },
  {
    "id": "math-117",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "2的负一次方 = _____",
    "options": [
      "-2",
      "-1/2",
      "1/2",
      "2"
    ],
    "answer": "1/2",
    "explanation": "2⁻¹ = 1/2¹ = 1/2"
  },
  {
    "id": "math-118",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "在△ABC中，AB=AC，若角A=40度，则角B=_____度",
    "options": [
      "40",
      "70",
      "140",
      "50"
    ],
    "answer": "70",
    "explanation": "等腰三角形，角B=角C=(180-40)/2=70度"
  },
  {
    "id": "math-119",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：(a³)² = _____",
    "options": [
      "a⁵",
      "a⁶",
      "a⁹",
      "2a³"
    ],
    "answer": "a⁶",
    "explanation": "幂的乘方，指数相乘：(a³)² = a³˟² = a⁶"
  },
  {
    "id": "math-120",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 3x - 1 ≤ 5 的解集是_____",
    "options": [
      "x ≤ 2",
      "x ≥ 2",
      "x ≤ -2",
      "x ≥ -2"
    ],
    "answer": "x ≤ 2",
    "explanation": "3x ≤ 6，x ≤ 2"
  },
  {
    "id": "math-121",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形的三条高交于一点，这一点叫三角形的_____",
    "options": [
      "重心",
      "垂心",
      "内心",
      "外心"
    ],
    "answer": "垂心",
    "explanation": "三角形三条高的交点叫垂心；重心是三条中线的交点；内心是三条角平分线的交点；外心是三条垂直平分线的交点"
  },
  {
    "id": "math-122",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "分式方程 1/x = 1/3 的解是_____",
    "options": [
      "x=3",
      "x=1/3",
      "x=0",
      "无解"
    ],
    "answer": "x=3",
    "explanation": "两边倒数：x=3，注意x不能为0"
  },
  {
    "id": "math-123",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "若 a² = 16，则 a = _____",
    "options": [
      "4",
      "-4",
      "±4",
      "8"
    ],
    "answer": "±4",
    "explanation": "平方根有两个，a = ±4"
  },
  {
    "id": "math-124",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：m² - n² = _____",
    "options": [
      "(m-n)²",
      "(m+n)²",
      "(m-n)(m+n)",
      "(m+n)(m-n)"
    ],
    "answer": "(m-n)(m+n)",
    "explanation": "平方差公式：a²-b²=(a-b)(a+b)"
  },
  {
    "id": "math-125",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：-5 + 3 = _____",
    "options": [
      "-8",
      "-2",
      "2",
      "8"
    ],
    "answer": "-2",
    "explanation": "-5+3=-2"
  },
  {
    "id": "math-126",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "方程组 3x+y=10, x-y=2 的解中 x+y=_____",
    "options": [
      "4",
      "6",
      "8",
      "10"
    ],
    "answer": "6",
    "explanation": "相加：4x=12→x=3，代入：3-y=2→y=1，所以x+y=4"
  },
  {
    "id": "math-127",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "若点P在第四象限，则点P的坐标特点是_____",
    "options": [
      "x>0,y>0",
      "x>0,y<0",
      "x<0,y>0",
      "x<0,y<0"
    ],
    "answer": "x>0,y<0",
    "explanation": "第四象限：x>0（正），y<0（负）"
  },
  {
    "id": "math-128",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式 x-3 > 2 的解集在数轴上表示正确的是_____",
    "options": [
      "x>5",
      "x<5",
      "x>1",
      "x<1"
    ],
    "answer": "x>5",
    "explanation": "x-3>2，x>5"
  },
  {
    "id": "math-129",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "三角形具有_____性",
    "options": [
      "稳定",
      "灵活",
      "对称",
      "以上都不是"
    ],
    "answer": "稳定",
    "explanation": "三角形具有稳定性，四边形具有不稳定性"
  },
  {
    "id": "math-130",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "函数 y = -2x + 4，当 x 增大时，y _____",
    "options": [
      "增大",
      "减小",
      "不变",
      "先增后减"
    ],
    "answer": "减小",
    "explanation": "k=-2<0，y随x增大而减小"
  },
  {
    "id": "math-131",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：(-3)² = _____",
    "options": [
      "9",
      "-9",
      "6",
      "-6"
    ],
    "answer": "9",
    "explanation": "(-3)² = 9，负数平方得正"
  },
  {
    "id": "math-132",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：(x-y)² - 4 = _____",
    "options": [
      "(x-y-2)(x-y+2)",
      "(x-y-2)²",
      "(x+y-2)(x-y+2)",
      "(x-y+2)²"
    ],
    "answer": "(x-y-2)(x-y+2)",
    "explanation": "平方差：a²-b²=(a-b)(a+b)，这里a=(x-y)，b=2"
  },
  {
    "id": "math-133",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "去括号：-(a-b) = _____",
    "options": [
      "-a-b",
      "-a+b",
      "a-b",
      "a+b"
    ],
    "answer": "-a+b",
    "explanation": "-(a-b) = -a+(-b) = -a+b，或直接：负号分配"
  },
  {
    "id": "math-134",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "下列说法正确的是：",
    "options": [
      "有限小数是有理数",
      "无限不循环小数是有理数",
      "带根号的数都是无理数",
      "所有分数都是有理数"
    ],
    "answer": "有限小数是有理数",
    "explanation": "有限小数和无限循环小数都是有理数；无限不循环小数是无理数；√4=2是有理数"
  },
  {
    "id": "math-135",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "一个三角形的三个内角度数比为1:2:3，则最大角是_____度",
    "options": [
      "30",
      "60",
      "90",
      "45"
    ],
    "answer": "90",
    "explanation": "设三角分别为x,2x,3x，x+2x+3x=180，6x=180，x=30，最大角3x=90度"
  },
  {
    "id": "math-136",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "分式"
    ],
    "question": "化简：(x²+2x+1)/(x+1) = _____",
    "options": [
      "x+1",
      "x²+2",
      "x-1",
      "x²-1"
    ],
    "answer": "x+1",
    "explanation": "分子=(x+1)²，约去(x+1)得x+1"
  },
  {
    "id": "math-137",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：0.1¹ = _____",
    "options": [
      "0.1",
      "1",
      "10",
      "0.01"
    ],
    "answer": "0.1",
    "explanation": "0.1¹ = 0.1"
  },
  {
    "id": "math-138",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一元一次方程"
    ],
    "question": "方程 7x + 2 = 3x + 18 的解是 x=_____",
    "options": [
      "2",
      "3",
      "4",
      "5"
    ],
    "answer": "4",
    "explanation": "7x-3x=18-2，4x=16，x=4"
  },
  {
    "id": "math-139",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：(-7) + 4 = _____",
    "options": [
      "-11",
      "-3",
      "3",
      "11"
    ],
    "answer": "-3",
    "explanation": "-7+4=-3"
  },
  {
    "id": "math-140",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "二元一次方程组"
    ],
    "question": "用代入法解方程组 y=2x, x+y=9，x=_____",
    "options": [
      "2",
      "3",
      "4",
      "5"
    ],
    "answer": "3",
    "explanation": "代入：x+2x=9，3x=9，x=3"
  },
  {
    "id": "math-141",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "等腰三角形的顶角是50度，底角是_____度",
    "options": [
      "50",
      "65",
      "130",
      "40"
    ],
    "answer": "65",
    "explanation": "底角=(180-50)/2=65度"
  },
  {
    "id": "math-142",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "一次函数"
    ],
    "question": "一次函数 y = kx + b，k>0且b<0，图像经过第_____象限",
    "options": [
      "一、二",
      "一、三",
      "二、三、四",
      "一、三、四"
    ],
    "answer": "一、三、四",
    "explanation": "k>0过一三象限，b<0过四象限，综合过一、三、四象限"
  },
  {
    "id": "math-143",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "若 a³ = 27，则 a = _____",
    "options": [
      "3",
      "9",
      "27",
      "±3"
    ],
    "answer": "3",
    "explanation": "a³=27，a=3"
  },
  {
    "id": "math-144",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "不等式"
    ],
    "question": "不等式组 2x<6, x+1>2 的解集是_____",
    "options": [
      "x<3",
      "x>1",
      "1<x<3",
      "x>3"
    ],
    "answer": "1<x<3",
    "explanation": "2x<6→x<3，x+1>2→x>1，取交集1<x<3"
  },
  {
    "id": "math-145",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "平面直角坐标系"
    ],
    "question": "点(2,-3)在第_____象限",
    "options": [
      "一",
      "二",
      "三",
      "四"
    ],
    "answer": "四",
    "explanation": "第四象限：x>0，y<0"
  },
  {
    "id": "math-146",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "因式分解"
    ],
    "question": "因式分解：5x²y - 10xy² = _____",
    "options": [
      "5xy(x-y)",
      "5xy(x-2y)",
      "5x²(y-2y)",
      "5xy(x+y)"
    ],
    "answer": "5xy(x-2y)",
    "explanation": "提公因式5xy：5xy(x-2y)"
  },
  {
    "id": "math-147",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "整式运算"
    ],
    "question": "计算：-2 × (-3) = _____",
    "options": [
      "-6",
      "6",
      "-5",
      "5"
    ],
    "answer": "6",
    "explanation": "负负得正，-2×(-3)=6"
  },
  {
    "id": "math-148",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "实数"
    ],
    "question": "√2 约等于_____（保留两位小数）",
    "options": [
      "1.41",
      "1.73",
      "2.24",
      "1.50"
    ],
    "answer": "1.41",
    "explanation": "√2≈1.41421356，保留两位小数1.41"
  },
  {
    "id": "math-149",
    "type": "choice",
    "subject": "math",
    "difficulty": 1,
    "grade": 8,
    "knowledgeTags": [
      "幂的运算"
    ],
    "question": "计算：2³ × 2⁴ = _____",
    "options": [
      "2⁷",
      "2¹²",
      "4⁷",
      "2⁷或128"
    ],
    "answer": "2⁷",
    "explanation": "同底数幂相乘，指数相加：2³⁺⁴=2⁷=128"
  },
  {
    "id": "math-150",
    "type": "choice",
    "subject": "math",
    "difficulty": 2,
    "grade": 8,
    "knowledgeTags": [
      "三角形"
    ],
    "question": "已知等腰三角形一边为4，另一边为9，周长是_____",
    "options": [
      "17",
      "22",
      "13",
      "17或22"
    ],
    "answer": "22",
    "explanation": "等腰三角形两腰相等，4+9+9=22（4+4=8<9不成立）；9+9+4=22（9+4>9成立）"
  }
];
