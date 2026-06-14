declare module 'asciichart' {
  interface PlotOptions {
    height?: number;
    offset?: number;
    padding?: string;
    format?: (value: number, index?: number) => string;
  }

  const asciichart: {
    plot(series: number[] | number[][], options?: PlotOptions): string;
  };

  export default asciichart;
}
