#!/usr/bin/env python3
"""
Skills 注册和测试脚本
用法：python test_skills.py
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def register_github_daily():
    """注册 github_daily skill"""
    data = {
        "name": "github_daily",
        "description": "每日 GitHub 项目推荐 - 从多个优质渠道获取热门项目",
        "content": "从 GitHub Trending、HelloGitHub、Hacker News、Trendshift 等多个渠道聚合每日热门项目推荐",
        "icon": "📊",
        "sort_order": 100,
        "config": {
            "type": "yaml",
            "path": "github_daily.yaml",
            "category": "github",
            "parameters": {
                "count": {"type": "integer", "default": 10},
                "language": {"type": "string", "default": ""},
                "days": {"type": "integer", "default": 1},
                "source": {"type": "string", "default": "all"},
                "min_stars": {"type": "integer", "default": 0}
            }
        }
    }

    try:
        response = requests.post(f"{BASE_URL}/skills", json=data, timeout=10)
        if response.status_code == 201:
            print("✓ github_daily 注册成功")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return response.json()
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("⚠ github_daily 已存在")
            return None
        else:
            print(f"✗ 注册失败: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到后端服务，请确保后端正在运行")
        return None
    except Exception as e:
        print(f"✗ 错误: {e}")
        return None


def register_github_miner():
    """注册 github_miner skill"""
    data = {
        "name": "github_miner",
        "description": "GitHub 项目数据挖掘 - 深度分析和挖掘 GitHub 项目数据",
        "content": "支持多维度搜索、趋势分析、生态分析、竞品对比、口碑分析等深度挖掘功能",
        "icon": "⛏️",
        "sort_order": 101,
        "config": {
            "type": "yaml",
            "path": "github_miner.yaml",
            "category": "github",
            "parameters": {
                "query": {"type": "string", "default": ""},
                "count": {"type": "integer", "default": 20},
                "language": {"type": "string", "default": ""},
                "min_stars": {"type": "integer", "default": 100},
                "sort_by": {"type": "string", "default": "stars"},
                "time_range": {"type": "string", "default": "all"},
                "analysis_mode": {"type": "string", "default": "basic"}
            }
        }
    }

    try:
        response = requests.post(f"{BASE_URL}/skills", json=data, timeout=10)
        if response.status_code == 201:
            print("✓ github_miner 注册成功")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return response.json()
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("⚠ github_miner 已存在")
            return None
        else:
            print(f"✗ 注册失败: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到后端服务，请确保后端正在运行")
        return None
    except Exception as e:
        print(f"✗ 错误: {e}")
        return None


def list_skills():
    """列出所有 skills"""
    try:
        response = requests.get(f"{BASE_URL}/skills", timeout=10)
        if response.status_code == 200:
            skills = response.json()
            print(f"\n📋 数据库中共有 {len(skills)} 个 skills:")
            for skill in skills:
                enabled = "✓" if skill.get("enabled", True) else "✗"
                print(f"  {enabled} {skill['name']}: {skill['description']}")
            return skills
        else:
            print(f"✗ 获取失败: {response.status_code}")
            return []
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到后端服务")
        return []
    except Exception as e:
        print(f"✗ 错误: {e}")
        return []


def get_skill_detail(skill_id):
    """获取 skill 详情"""
    try:
        response = requests.get(f"{BASE_URL}/skills/{skill_id}", timeout=10)
        if response.status_code == 200:
            print(f"\n📄 Skill 详情:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return response.json()
        else:
            print(f"✗ 获取失败: {response.status_code}")
            return None
    except Exception as e:
        print(f"✗ 错误: {e}")
        return None


def test_skill_execution(skill_name, params=""):
    """测试 skill 执行（需要创建对话）"""
    print(f"\n🧪 测试 {skill_name} 执行...")

    # 1. 创建测试对话
    try:
        conv_data = {
            "title": f"测试 {skill_name}",
            "model_provider": "claude"
        }
        response = requests.post(f"{BASE_URL}/chat", json=conv_data, timeout=10)
        if response.status_code != 201:
            print(f"✗ 创建对话失败: {response.status_code}")
            return

        conv = response.json()
        conv_id = conv["id"]
        print(f"✓ 创建测试对话: {conv_id}")

        # 2. 发送 skill 命令
        message_data = {
            "content": f"/{skill_name} {params}".strip()
        }
        print(f"📤 发送消息: {message_data['content']}")

        response = requests.post(
            f"{BASE_URL}/chat/{conv_id}/messages",
            json=message_data,
            timeout=60
        )

        if response.status_code == 200:
            print("✓ Skill 执行成功")
            print("\n📥 返回数据预览:")
            # 流式响应，只显示前500字符
            content = response.text[:500]
            print(content)
            if len(response.text) > 500:
                print(f"... (还有 {len(response.text) - 500} 字符)")
        else:
            print(f"✗ 执行失败: {response.status_code}")
            print(response.text[:500])

    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到后端服务")
    except Exception as e:
        print(f"✗ 错误: {e}")


def main():
    print("=" * 60)
    print("MutiExpert Skills 注册和测试")
    print("=" * 60)

    # 1. 注册 skills
    print("\n📝 步骤 1: 注册 Skills")
    print("-" * 60)
    register_github_daily()
    print()
    register_github_miner()

    # 2. 列出所有 skills
    print("\n📋 步骤 2: 列出所有 Skills")
    print("-" * 60)
    skills = list_skills()

    # 3. 获取 github_daily 详情
    if skills:
        github_daily = next((s for s in skills if s["name"] == "github_daily"), None)
        if github_daily:
            print("\n📄 步骤 3: 获取 github_daily 详情")
            print("-" * 60)
            get_skill_detail(github_daily["id"])

    # 4. 测试执行（可选）
    print("\n" + "=" * 60)
    print("测试完成！")
    print("\n💡 提示：")
    print("  - 在聊天界面输入: /github_daily")
    print("  - 或带参数: /github_daily count=15 language=python")
    print("  - 数据挖掘: /github_miner query=\"AI agent\" analysis_mode=deep")
    print("=" * 60)


if __name__ == "__main__":
    main()
