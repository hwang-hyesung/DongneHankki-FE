import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
const URL = 'https://dh.porogramr.site/api';

const showToast = (text: string) =>{
    Toast.show({
        type: 'error',
        position: 'bottom',
        text1: text,
      });
};

export const getTokens = async (
  id: string,
  password: string
): Promise<void> => {
  try {
    const res = await axios.post(`${URL}/login`, {
      loginId: id,
      password,
    });

    if (res.status === 200 && res.data.status === 'success') {
      const accessToken = res?.data?.data?.accessToken;
      const refreshToken = res?.data?.data?.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error("토큰이 없습니다.");
      }

      await AsyncStorage.setItem(
        'Tokens',
        JSON.stringify({
          accessToken: res.data.data.accessToken,
          refreshToken: res.data.data.refreshToken,
        }),
      );
    } else {
      throw new Error(res.data.message || '로그인에 실패했습니다.');
    }
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      throw new Error(error.response.data.message || '가입되지 않은 id,pw 입니다');
    } else {
      throw new Error('알 수 없는 오류가 발생했습니다.');
    }
  }
};

const getTokenFromLocal = async (): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
} | null> => {
  try {
    console.log("GETTOKEN 시작");
    const value = await AsyncStorage.getItem("Tokens");
    
    if (value === null || value === undefined) {
      console.log("저장된 토큰 없음");
      return null;
    }

    const parsedToken = JSON.parse(value);
    
    // 토큰 구조 검증
    if (!parsedToken || typeof parsedToken !== 'object') {
      console.log("토큰이 객체가 아님");
      return null;
    }

    if (!parsedToken.accessToken || !parsedToken.refreshToken) {
      console.log("토큰 필드 누락");
      return null;
    }

    console.log("토큰 로드 성공");
    return parsedToken;
    
  } catch (e: any) {
    console.error("토큰 로드 오류:", e.message);
    return null;
  }
};


export const verifyTokens = async (
  navigation: NativeStackNavigationProp<any>
) => {
  try {
    console.log("VERIFYTOKEN 시작");
    
    const Token = await getTokenFromLocal();
    console.log("토큰 확인:", Token ? "토큰 있음" : "토큰 없음");

    // 최초 접속
    if (Token === null) {
      console.log("최초 접속 - 로그인 화면으로 이동");
      navigation.reset({ routes: [{ name: "Login" }] });
      return;
    }

    // 토큰 유효성 검사
    if (!Token.accessToken || !Token.refreshToken) {
      console.log("토큰이 유효하지 않음 - 로그인 화면으로 이동");
      navigation.reset({ routes: [{ name: "Login" }] });
      return;
    }

    // 로컬 스토리지에 Token데이터가 있으면 -> 토큰들을 헤더에 넣어 검증 
    const headers_config = {
      "refresh": Token.refreshToken,
      Authorization: `Bearer ${Token.accessToken}`
    };

    try {
      console.log("토큰 검증 요청 시작");
      const res = await axios.get(`${URL}/refresh`, { 
        headers: headers_config,
        timeout: 10000 // 10초 타임아웃
      });

      console.log("토큰 검증 성공");
      
      // accessToken 만료, refreshToken 정상 -> 재발급된 accessToken 저장 후 자동 로그인
      if (res.data && res.data.data && res.data.data.accessToken) {
        await AsyncStorage.setItem('Tokens', JSON.stringify({
          ...Token,
          'accessToken': res.data.data.accessToken,
        }));
        console.log("새 토큰 저장 완료");
      }
      
      navigation.reset({ routes: [{ name: "RegisterComplete" }] });

    } catch (error: any) {
      console.log("토큰 검증 실패:", error.message);
      
      const code = error.response?.data?.code;
      const status = error.response?.status;

      // accessToken 만료, refreshToken 만료 -> 로그인 페이지
      if (code === 401 || status === 401) {
        console.log("인증 실패 - 로그인 화면으로 이동");
        navigation.reset({ routes: [{ name: "Login" }] });
      }
      // 네트워크 오류나 기타 오류 -> 로그인 페이지로 이동
      else {
        console.log("기타 오류 - 로그인 화면으로 이동");
        navigation.reset({ routes: [{ name: "Login" }] });
      }
    }

  } catch (error: any) {
    console.error("verifyTokens 전체 오류:", error.message);
    // 오류 발생 시 로그인 화면으로 이동
    try {
      navigation.reset({ routes: [{ name: "Login" }] });
    } catch (navError) {
      console.error("네비게이션 오류:", navError);
    }
  }
};