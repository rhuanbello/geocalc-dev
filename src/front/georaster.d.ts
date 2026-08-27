declare module "georaster" {
  const parseGeoraster: (input: string | ArrayBuffer | Blob) => Promise<any>;
  export default parseGeoraster;
}
