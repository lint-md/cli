export const averagedGroup = <T>(
  items: T[],
  groupCount: number,
  groupCalculator: (item: T) => number
) => {
  const itemsToGroup = [...items]
    .map((item) => {
      return {
        value: item,
        power: groupCalculator(item),
      };
    })
    .sort((a, b) => {
      return b.power - a.power;
    });

  // 每组的平均值
  const groupAverage = itemsToGroup.reduce((acc, item) => {
    return acc + item.power;
  }, 0) / groupCount;

  const groups = new Array(groupCount).fill('').map(() => {
    return {
      totalPower: 0,
      items: [] as T[],
    };
  });

  for (const item of itemsToGroup) {
    for (const group of groups) {
      const currentItemPower = item.power;

      // 大于平均值的单独存放
      if (currentItemPower > groupAverage) {
        group.items.push(item.value);
        group.totalPower += currentItemPower;
        break;
      }
      else {
        // 小于等于平均值的，如果小于当前组总值，可放入
        if (group.totalPower < groupAverage) {
          group.items.push(item.value);
          group.totalPower += currentItemPower;
          break;
        }
      }
    }
  }

  return groups;
};
