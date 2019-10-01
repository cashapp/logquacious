import {GlobalWithFetchMock} from "jest-fetch-mock";
// @ts-ignore
import jest_fetch_mock from "jest-fetch-mock"

const customGlobal: GlobalWithFetchMock = global as GlobalWithFetchMock;
customGlobal.fetch = jest_fetch_mock;
customGlobal.fetchMock = customGlobal.fetch;
